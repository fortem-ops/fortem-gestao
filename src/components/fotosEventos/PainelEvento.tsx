import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { totais } from "@/lib/fotosEventos";
import { fotosAdmin, type EventoFotos } from "./api";

type RespIndexar = { processadas: number; restantes: number; resultado: Record<string, number> };

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return <Card className="p-4"><p className="text-xs text-muted-foreground">{rotulo}</p><p className={`text-2xl font-bold ${cor ?? ""}`}>{valor}</p></Card>;
}

export default function PainelEvento({ evento }: { evento: EventoFotos }) {
  const qc = useQueryClient();
  const parar = useRef(false);
  const [indexando, setIndexando] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);

  const { data: fotos = [] } = useQuery({
    queryKey: ["fotos-evento", evento.id, "totais"],
    queryFn: async () => {
      const todas: { origem: string; status_moderacao: string; status_indexacao: string; upload_concluido: boolean }[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase.from("fotos_evento").select("origem, status_moderacao, status_indexacao, upload_concluido").eq("evento_id", evento.id).range(de, de + 999);
        if (error) throw error;
        todas.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return todas;
    },
    refetchInterval: indexando ? 5000 : false,
  });
  const { data: buscas = 0 } = useQuery({
    queryKey: ["fotos-evento", evento.id, "buscas"],
    queryFn: async () => (await supabase.from("fotos_buscas_log").select("id", { count: "exact", head: true }).eq("evento_id", evento.id)).count ?? 0,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["fotos-evento", evento.id, "leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads_fotos").select("*").eq("evento_id", evento.id).order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const t = totais(fotos);

  async function indexar(acao: "indexar" | "reprocessar_erros") {
    parar.current = false; setIndexando(true);
    try {
      let r = await fotosAdmin<RespIndexar>(acao, { evento_id: evento.id });
      setRestantes(r.restantes);
      while (!parar.current && r.restantes > 0 && r.processadas > 0) {
        r = await fotosAdmin<RespIndexar>("indexar", { evento_id: evento.id });
        setRestantes(r.restantes);
      }
      toast.success(parar.current ? "Indexação pausada. Pode continuar depois." : "Indexação concluída.");
    } catch (e) {
      toast.error(`Indexação interrompida: ${e instanceof Error ? e.message : "erro"}. Clique em continuar para retomar.`);
    } finally {
      setIndexando(false);
      qc.invalidateQueries({ queryKey: ["fotos-evento", evento.id] });
    }
  }

  async function exportar() {
    try {
      const { csv } = await fotosAdmin<{ csv: string }>("leads_csv", { evento_id: evento.id });
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `leads-${evento.slug}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(`Não foi possível exportar: ${e instanceof Error ? e.message : "erro"}`); }
  }

  async function limpar() {
    try {
      const { removidas } = await fotosAdmin<{ removidas: number }>("limpar_incompletos", { evento_id: evento.id });
      toast.success(`${removidas} envio(s) incompleto(s) removido(s).`);
      qc.invalidateQueries({ queryKey: ["fotos-evento", evento.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "erro"); }
  }

  const aIndexar = restantes ?? t.a_indexar;
  const base = t.aprovadas || 1;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Numero rotulo="Fotos" valor={t.total} />
        <Numero rotulo="Do fotógrafo" valor={t.fotografo} />
        <Numero rotulo="De convidados" valor={t.convidado} />
        <Numero rotulo="Buscas por selfie" valor={buscas} />
        <Numero rotulo="Aguardando moderação" valor={t.pendentes} />
        <Numero rotulo="Aprovadas" valor={t.aprovadas} />
        <Numero rotulo="Rejeitadas" valor={t.rejeitadas} />
        <Numero rotulo="Leads" valor={leads.length} />
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Indexação de rostos</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Indexadas: <b>{t.indexadas}</b></span><span>Sem rosto: <b>{t.sem_rosto}</b></span>
          <span>A indexar: <b>{aIndexar}</b></span><span className={t.erro ? "text-destructive" : ""}>Com erro: <b>{t.erro}</b></span>
        </div>
        <Progress value={((t.indexadas + t.sem_rosto) / base) * 100} />
        <div className="flex flex-wrap gap-2">
          {indexando
            ? <Button variant="outline" onClick={() => { parar.current = true; }}><Square className="h-4 w-4 mr-2" />Pausar</Button>
            : <Button onClick={() => void indexar("indexar")} disabled={!t.a_indexar}><Play className="h-4 w-4 mr-2" />{t.indexadas || t.sem_rosto ? "Continuar indexação" : "Indexar fotos"}</Button>}
          <Button variant="outline" onClick={() => void indexar("reprocessar_erros")} disabled={indexando || !t.erro}><RotateCcw className="h-4 w-4 mr-2" />Reprocessar com erro</Button>
          {t.incompletas > 0 && <Button variant="ghost" onClick={() => void limpar()} disabled={indexando}><Trash2 className="h-4 w-4 mr-2" />Limpar {t.incompletas} envio(s) incompleto(s)</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Processa 5 fotos por vez. Se fechar a aba, é só voltar e clicar em continuar. Envios incompletos com mais de 2 horas podem ser limpos.</p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Leads</h3>
          <Button variant="outline" size="sm" onClick={() => void exportar()} disabled={!leads.length}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>WhatsApp</TableHead><TableHead>E-mail</TableHead><TableHead className="text-right">Buscas</TableHead><TableHead className="text-right">Encontradas</TableHead><TableHead className="text-right">Enviadas</TableHead></TableRow></TableHeader>
          <TableBody>
            {leads.slice(0, 200).map((l) => (
              <TableRow key={l.id}><TableCell>{l.nome}</TableCell><TableCell>{l.whatsapp}</TableCell><TableCell>{l.email ?? "—"}</TableCell>
                <TableCell className="text-right">{l.qtd_buscas}</TableCell><TableCell className="text-right">{l.qtd_fotos_encontradas}</TableCell><TableCell className="text-right">{l.qtd_fotos_enviadas}</TableCell></TableRow>
            ))}
            {!leads.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum lead ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
