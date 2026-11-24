import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarMoedaBr } from "@/lib/promo10Texto";
import {
  type InteressePromo10Admin,
  type SegmentoFiltroPromo10,
  type StatusInteressePromo10,
  SEGMENTOS_PROMO10_LISTA,
  STATUS_PROMO10_LISTA,
  calcularResumoPromo10,
  rotuloOfertaEquipePromo10,
  rotuloSegmentoPromo10,
  segmentoEfetivoPromo10,
} from "@/lib/promo10Admin";
import Promo10DetalheSheet from "@/components/comercial/Promo10DetalheSheet";

const STATUS_BADGE: Record<StatusInteressePromo10, string> = {
  novo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  contatado: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  fechado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  desistiu: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export default function Promo10Admin() {
  const { data: roles, isLoading: loadingRoles } = useUserRoles();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroSegmento, setFiltroSegmento] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<InteressePromo10Admin | null>(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["promo10-interesses-admin"],
    enabled: Boolean(roles?.isAdmin),
    queryFn: async (): Promise<InteressePromo10Admin[]> => {
      const { data: rows, error } = await supabase
        .from("promo10_interesses")
        .select("id, aluno_id, segmento, oferta, detalhes, valor_promocional, valor_sem_desconto, codigo_pedido, status, observacao, created_at, atualizado_por, atualizado_em")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const lista = rows ?? [];
      const alunoIds = [...new Set(lista.map((r) => r.aluno_id))];
      const staffIds = [...new Set(lista.map((r) => r.atualizado_por).filter((v): v is string => Boolean(v)))];

      const [{ data: alunos }, { data: profiles }] = await Promise.all([
        alunoIds.length
          ? supabase.from("alunos").select("id, nome, telefone").in("id", alunoIds)
          : Promise.resolve({ data: [] as { id: string; nome: string; telefone: string | null }[] }),
        staffIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", staffIds)
          : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
      ]);

      const mapaAlunos = new Map((alunos ?? []).map((a) => [a.id, a]));
      const mapaStaff = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

      return lista.map((r) => {
        const aluno = mapaAlunos.get(r.aluno_id);
        return {
          id: r.id,
          aluno_id: r.aluno_id,
          aluno_nome: aluno?.nome ?? "Aluno",
          aluno_telefone: aluno?.telefone ?? null,
          segmento: r.segmento,
          oferta: r.oferta,
          detalhes: (r.detalhes && typeof r.detalhes === "object" && !Array.isArray(r.detalhes)
            ? r.detalhes
            : {}) as Record<string, unknown>,
          valor_promocional: Number(r.valor_promocional),
          valor_sem_desconto: r.valor_sem_desconto != null ? Number(r.valor_sem_desconto) : null,
          codigo_pedido: r.codigo_pedido,
          status: r.status as StatusInteressePromo10,
          observacao: r.observacao,
          created_at: r.created_at,
          atualizado_por: r.atualizado_por,
          atualizado_por_nome: r.atualizado_por ? (mapaStaff.get(r.atualizado_por) ?? null) : null,
          atualizado_em: r.atualizado_em,
        };
      });
    },
  });

  const resumo = useMemo(() => calcularResumoPromo10(itens), [itens]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (filtroStatus !== "todos" && item.status !== filtroStatus) return false;
      if (filtroSegmento !== "todos") {
        const seg = segmentoEfetivoPromo10(item.segmento, item.oferta, item.detalhes);
        if (seg !== (filtroSegmento as SegmentoFiltroPromo10)) return false;
      }
      if (termo) {
        const bateNome = item.aluno_nome.toLowerCase().includes(termo);
        const bateCodigo = item.codigo_pedido.toLowerCase().includes(termo);
        if (!bateNome && !bateCodigo) return false;
      }
      return true;
    });
  }, [itens, filtroStatus, filtroSegmento, busca]);

  if (loadingRoles) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!roles?.isAdmin) return <Navigate to="/equipe" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Promoções 10 anos</h1>
          <p className="text-sm text-muted-foreground">
            Interesses registrados na campanha de aniversário ({resumo.totalQuantidade} no total · {formatarMoedaBr(resumo.totalValor)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_PROMO10_LISTA.map((s) => {
          const bloco = resumo.porStatus[s.valor];
          return (
            <Card key={s.valor}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{bloco.quantidade}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatarMoedaBr(bloco.valor)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SEGMENTOS_PROMO10_LISTA.map((s) => {
          const bloco = resumo.porSegmento[s.valor];
          return (
            <Card key={s.valor}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold mt-0.5">{bloco.quantidade}</p>
                <p className="text-xs text-muted-foreground">{formatarMoedaBr(bloco.valor)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do aluno ou código P10-xxxx..."
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_PROMO10_LISTA.map((s) => (
              <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSegmento} onValueChange={setFiltroSegmento}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os segmentos</SelectItem>
            {SEGMENTOS_PROMO10_LISTA.map((s) => (
              <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum interesse encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Oferta</TableHead>
                  <TableHead className="text-right">Promocional</TableHead>
                  <TableHead className="text-right">Sem desconto</TableHead>
                  <TableHead className="text-right">Economia</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((item) => {
                  const seg = segmentoEfetivoPromo10(item.segmento, item.oferta, item.detalhes);
                  const econ = item.valor_sem_desconto != null ? Math.max(0, item.valor_sem_desconto - item.valor_promocional) : null;
                  const statusLabel = STATUS_PROMO10_LISTA.find((s) => s.valor === item.status)?.label ?? item.status;
                  return (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelecionado(item)}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{item.codigo_pedido}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link to={`/alunos/${item.aluno_id}`} className="font-medium hover:underline text-primary">
                          {item.aluno_nome}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{rotuloSegmentoPromo10(seg)}</TableCell>
                      <TableCell>{rotuloOfertaEquipePromo10(item)}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarMoedaBr(item.valor_promocional)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                        {item.valor_sem_desconto != null ? formatarMoedaBr(item.valor_sem_desconto) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-emerald-400 whitespace-nowrap">
                        {econ != null ? formatarMoedaBr(econ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[item.status]}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {item.observacao ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Promo10DetalheSheet item={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}