import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mascararTelefone, STATUS_CAMPANHA_LABEL, STATUS_DEST_LABEL } from "@/lib/disparos";

type Campanha = {
  id: string; nome: string; status: string; criado_em: string; total_preparado: number | null;
  modelo: { nome: string | null; meta_nome: string | null } | null;
};
type Contagem = { enviado: number; falhou: number; ignorado: number; pendente: number };
const POR_PAGINA = 50;

const corStatus = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "concluida" || s === "enviado" ? "default" : s === "falhou" || s === "cancelada" ? "destructive" : s === "rascunho" ? "outline" : "secondary";

async function contar(campanhaId: string): Promise<Contagem> {
  const q = (st: string[]) => supabase.from("msg_campanha_destinatarios").select("id", { count: "exact", head: true })
    .eq("campanha_id", campanhaId).in("status", st);
  const [e, f, i, p] = await Promise.all([q(["enviado"]), q(["falhou"]), q(["ignorado"]), q(["pendente", "enviando"])]);
  return { enviado: e.count ?? 0, falhou: f.count ?? 0, ignorado: i.count ?? 0, pendente: p.count ?? 0 };
}

export function useContagem(campanhaId: string | null) {
  return useQuery({ queryKey: ["msg_contagem", campanhaId], enabled: !!campanhaId, queryFn: () => contar(campanhaId!) });
}

export function DestinatariosTabela({ campanhaId, filtroInicial = "" }: { campanhaId: string; filtroInicial?: string }) {
  const [status, setStatus] = useState(filtroInicial);
  const [pagina, setPagina] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ["msg_dest", campanhaId, status, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from("msg_campanha_destinatarios").select("id, nome, telefone_norm, status, erro", { count: "exact" })
        .eq("campanha_id", campanhaId).order("nome").range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (status) q = q.eq("status", status);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const totalPaginas = Math.max(1, Math.ceil((data?.count ?? 0) / POR_PAGINA));
  return (
    <Card>
      <div className="flex flex-wrap gap-2 p-2">
        {["", "pendente", "enviado", "falhou", "ignorado"].map((s) => (
          <Button key={s || "todos"} size="sm" variant={status === s ? "default" : "outline"} className="rounded-full"
            onClick={() => { setStatus(s); setPagina(0); }}>{s ? STATUS_DEST_LABEL[s] : "Todos"}</Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr><th className="p-2">Nome</th><th className="p-2">Telefone</th><th className="p-2">Status</th><th className="p-2">Detalhe</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={4} className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              : !data?.rows.length ? <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum destinatário.</td></tr>
              : data.rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.nome}</td>
                  <td className="p-2 font-mono text-xs">{mascararTelefone(r.telefone_norm)}</td>
                  <td className="p-2"><Badge variant={corStatus(r.status)}>{STATUS_DEST_LABEL[r.status] ?? r.status}</Badge></td>
                  <td className="p-2 text-muted-foreground">{r.erro}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between p-2 text-sm">
        <span className="text-muted-foreground">{data?.count ?? 0} no total · página {pagina + 1} de {totalPaginas}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
        </div>
      </div>
    </Card>
  );
}

function Detalhe({ c, onVoltar }: { c: Campanha; onVoltar: () => void }) {
  const qc = useQueryClient();
  const { data: k } = useContagem(c.id);
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const podeCancelar = !["concluida", "cancelada"].includes(c.status) && (k?.enviado ?? 0) === 0;
  const cancelar = async () => {
    setCancelando(true);
    const { data, error } = await supabase.functions.invoke("disparo-campanha", { body: { action: "cancelar", campanha_id: c.id } });
    setCancelando(false); setConfirmar(false);
    if (error || (data as { error?: string })?.error) { toast.error((data as { error?: string })?.error ?? "Não foi possível cancelar."); return; }
    toast.success("Disparo cancelado.");
    qc.invalidateQueries({ queryKey: ["msg_hist"] }); qc.invalidateQueries({ queryKey: ["msg_contagem", c.id] }); qc.invalidateQueries({ queryKey: ["msg_dest", c.id] });
    onVoltar();
  };
  const kpis: [string, number | string][] = [
    ["Enviadas", k?.enviado ?? "…"], ["Falhas", k?.falhou ?? "…"], ["Ignoradas", k?.ignorado ?? "…"], ["Pendentes", k?.pendente ?? "…"],
    ["Entregues", "—"], ["Lidas", "—"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onVoltar}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
        <h2 className="text-lg font-semibold">{c.nome}</h2>
        <Badge variant={corStatus(c.status)}>{STATUS_CAMPANHA_LABEL[c.status] ?? c.status}</Badge>
        {podeCancelar && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setConfirmar(true)}><XCircle className="h-4 w-4 mr-1" />Cancelar disparo</Button>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([l, v]) => (
          <Card key={l}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Entregues e lidas ficam disponíveis quando o WhatsApp devolver os status.</p>
      <DestinatariosTabela campanhaId={c.id} />
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este disparo?</AlertDialogTitle>
            <AlertDialogDescription>Os destinatários pendentes viram "Ignorado" e o disparo não poderá mais ser enviado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={cancelando} onClick={(e) => { e.preventDefault(); cancelar(); }}>Cancelar disparo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinhaCampanha({ c, onAbrir }: { c: Campanha; onAbrir: () => void }) {
  const { data: k } = useContagem(c.id);
  return (
    <tr className="border-b cursor-pointer hover:bg-muted/40" onClick={onAbrir}>
      <td className="p-2 font-medium">{c.nome}</td>
      <td className="p-2">{c.modelo?.nome ?? "—"}<span className="block text-xs text-muted-foreground">{c.modelo?.meta_nome}</span></td>
      <td className="p-2"><Badge variant={corStatus(c.status)}>{STATUS_CAMPANHA_LABEL[c.status] ?? c.status}</Badge></td>
      <td className="p-2">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</td>
      <td className="p-2 text-right">{c.total_preparado ?? "—"}</td>
      <td className="p-2 text-right text-xs">{k ? `${k.enviado} / ${k.falhou} / ${k.ignorado} / ${k.pendente}` : "…"}</td>
    </tr>
  );
}

export default function DisparosHistorico() {
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<Campanha | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["msg_hist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("msg_campanhas")
        .select("id, nome, status, criado_em, total_preparado, modelo:msg_modelos(nome, meta_nome)").order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campanha[];
    },
  });
  if (aberta) return <Detalhe c={aberta} onVoltar={() => setAberta(null)} />;
  const lista = (data ?? []).filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Disparos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr><th className="p-2">Nome</th><th className="p-2">Modelo</th><th className="p-2">Status</th><th className="p-2">Criado em</th>
                <th className="p-2 text-right">Preparados</th><th className="p-2 text-right">Env. / Falhas / Ign. / Pend.</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                : lista.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum disparo.</td></tr>
                : lista.map((c) => <LinhaCampanha key={c.id} c={c} onAbrir={() => setAberta(c)} />)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
