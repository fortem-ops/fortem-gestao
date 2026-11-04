import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConciliarSaidaDialog } from "@/components/financeiro/ConciliarSaidaDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";

/** Conciliação vale daqui pra frente (mesma data da função diária). */
const DATA_INICIO_CONCILIACAO = "2026-10-01";
const JANELA_MANUAL_DIAS = 7;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const addDias = (d: string, n: number) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

interface Movimento {
  id: string; data_entrada: string; tipo_operacao: string; valor: number;
  titulo: string | null; descricao: string | null;
}
interface Vinculo { movimento_id: string; tipo_match: string }

function useDados() {
  return useQuery({
    queryKey: ["conciliacao-bancaria"],
    queryFn: async () => {
      const movs: Movimento[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("inter_extrato_movimentos")
          .select("id, data_entrada, tipo_operacao, valor, titulo, descricao")
          .gte("data_entrada", DATA_INICIO_CONCILIACAO)
          .order("data_entrada", { ascending: false }).order("id").range(from, from + 999);
        if (error) throw error;
        movs.push(...((data ?? []) as Movimento[]));
        if (!data || data.length < 1000) break;
      }
      const vincs: Vinculo[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("conciliacoes_bancarias")
          .select("movimento_id, tipo_match").eq("desfeito", false).range(from, from + 999);
        if (error) throw error;
        vincs.push(...((data ?? []) as Vinculo[]));
        if (!data || data.length < 1000) break;
      }
      return { movs, vincs };
    },
  });
}

export default function ConciliacaoBancaria() {
  const { data: roles } = useUserRoles();
  const canEdit = !!roles?.isCoordAdmin;
  const { data, isLoading } = useDados();
  const [sel, setSel] = useState<Movimento | null>(null);
  const [params, setParams] = useSearchParams();
  const movParam = params.get("mov");
  useEffect(() => {
    if (!movParam || !data || !canEdit) return;
    const m = data.movs.find((x) => x.id === movParam);
    const jaVinculado = data.vincs.some((v) => v.movimento_id === movParam);
    if (m && !jaVinculado) setSel(m);
    else if (m) toast.info("Esta saída já foi conciliada.");
    params.delete("mov"); setParams(params, { replace: true });
  }, [movParam, data, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const { pendentes, totalMes, autoMes } = useMemo(() => {
    const movs = data?.movs ?? [];
    const mapa = new Map((data?.vincs ?? []).map((v) => [v.movimento_id, v.tipo_match]));
    const ini = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const doMes = movs.filter((m) => m.data_entrada >= ini && m.data_entrada <= fim);
    return {
      pendentes: movs.filter((m) => !mapa.has(m.id)),
      totalMes: doMes.length,
      autoMes: doMes.filter((m) => mapa.get(m.id) === "automatico").length,
    };
  }, [data]);
  const pct = totalMes ? Math.round((autoMes / totalMes) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold">Conciliação Bancária</h1>
        <p className="text-sm text-muted-foreground">
          Extrato do Banco Inter conciliado com Receitas e Despesas (a partir de {fmtData(DATA_INICIO_CONCILIACAO)}).
        </p>
      </div>
      {!canEdit && <Badge variant="secondary">Modo somente leitura — apenas Admin/Coordenador podem vincular.</Badge>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Conciliados automaticamente neste mês</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{pct}%</div>
          <p className="text-sm text-muted-foreground">{autoMes} de {totalMes} movimentos deste mês já conciliados automaticamente</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Movimentos pendentes ({pendentes.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && pendentes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum movimento pendente.</TableCell></TableRow>
              )}
              {pendentes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{fmtData(m.data_entrada)}</TableCell>
                  <TableCell className="max-w-[420px]">
                    <div className="font-medium truncate">{m.titulo || "—"}</div>
                    {m.descricao && <div className="text-xs text-muted-foreground truncate">{m.descricao}</div>}
                  </TableCell>
                  <TableCell>
                    {m.tipo_operacao === "C"
                      ? <Badge className="status-active">Entrada</Badge>
                      : <Badge variant="outline">Saída</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(m.valor))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSel(m)}>
                      <Link2 className="h-4 w-4 mr-1" /> Vincular manualmente
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AjustesRecentes canEdit={canEdit} />

      {sel && sel.tipo_operacao === "D" && <ConciliarSaidaDialog mov={sel} onClose={() => setSel(null)} />}
      {sel && sel.tipo_operacao !== "D" && <VincularDialog mov={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

interface Candidato { id: string; descricao: string; valor: number; data: string | null; conta_bancaria: string | null }

function VincularDialog({ mov, onClose }: { mov: Movimento; onClose: () => void }) {
  const qc = useQueryClient();
  const tabela = mov.tipo_operacao === "C" ? "receitas" : "despesas";
  const campoData = tabela === "receitas" ? "data_recebimento" : "data_pagamento";
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const cands = useQuery({
    queryKey: ["conciliacao-candidatos", mov.id],
    queryFn: async () => {
      const ini = addDias(mov.data_entrada, -JANELA_MANUAL_DIAS);
      const fim = addDias(mov.data_entrada, JANELA_MANUAL_DIAS);
      const q = tabela === "receitas"
        ? supabase.from("receitas").select("id, descricao, valor, data_recebimento, data_competencia, conta_bancaria")
            .eq("conciliado", false)
            .or(`and(data_recebimento.gte.${ini},data_recebimento.lte.${fim}),and(data_recebimento.is.null,data_competencia.gte.${ini},data_competencia.lte.${fim})`)
        : supabase.from("despesas").select("id, descricao, valor, data_pagamento, data_competencia, conta_bancaria")
            .eq("conciliado", false)
            .or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_competencia.gte.${ini},data_competencia.lte.${fim})`);
      const { data, error } = await q.limit(300);
      if (error) throw error;
      const alvo = Number(mov.valor);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string, descricao: r.descricao as string, valor: Number(r.valor),
        data: (r[campoData] as string | null) ?? (r.data_competencia as string | null),
        conta_bancaria: r.conta_bancaria as string | null,
      })).sort((a, b) => Math.abs(a.valor - alvo) - Math.abs(b.valor - alvo)) as Candidato[];
    },
  });

  const vincular = useMutation({
    mutationFn: async (registroId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const c = cands.data?.find((x) => x.id === registroId);
      const { error } = await supabase.from("conciliacoes_bancarias").insert({
        movimento_id: mov.id, tabela_origem: tabela, registro_id: registroId, tipo_match: "manual",
        confianca: c?.data === mov.data_entrada && Math.abs((c?.valor ?? 0) - Number(mov.valor)) < 0.005 ? "exata" : "aproximada",
        criado_por: u.user?.id ?? null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Este movimento já foi vinculado.");
        throw error;
      }
      const { error: e2 } = await supabase.from(tabela).update({ conciliado: true, updated_by: u.user?.id ?? null }).eq("id", registroId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Movimento vinculado");
      qc.invalidateQueries({ queryKey: ["conciliacao-bancaria"] });
      qc.invalidateQueries({ queryKey: [tabela] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao vincular"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Vincular {mov.tipo_operacao === "C" ? "entrada" : "saída"} de {brl(Number(mov.valor))} em {fmtData(mov.data_entrada)}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {tabela === "receitas" ? "Receitas" : "Despesas"} não conciliadas entre {fmtData(addDias(mov.data_entrada, -JANELA_MANUAL_DIAS))} e {fmtData(addDias(mov.data_entrada, JANELA_MANUAL_DIAS))}, ordenadas pelo valor mais próximo.
        </p>
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead /><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {cands.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!cands.isLoading && (cands.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum lançamento encontrado no período.</TableCell></TableRow>
              )}
              {(cands.data ?? []).map((c) => (
                <TableRow key={c.id} className={`cursor-pointer ${escolhido === c.id ? "bg-muted" : ""}`} onClick={() => setEscolhido(c.id)}>
                  <TableCell><input type="radio" checked={escolhido === c.id} onChange={() => setEscolhido(c.id)} /></TableCell>
                  <TableCell>{c.descricao}</TableCell>
                  <TableCell>{fmtData(c.data)}</TableCell>
                  <TableCell>{c.conta_bancaria ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(c.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!escolhido || vincular.isPending} onClick={() => escolhido && vincular.mutate(escolhido)}>
            {vincular.isPending ? "Vinculando…" : "Confirmar vínculo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Últimas saídas conciliadas manualmente, com opção de desfazer (volta o valor anterior da despesa). */
function AjustesRecentes({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["conciliacao-bancaria", "manuais-saida"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conciliacoes_bancarias")
        .select("id, movimento_id, registro_id, valor_anterior, created_at, tabela_origem, motivo")
        .eq("desfeito", false).eq("tipo_match", "manual").in("tabela_origem", ["despesas", "despesas_multiplas", "ignorado"])
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.registro_id);
      const { data: desp } = ids.length
        ? await supabase.from("despesas").select("id, descricao, valor").in("id", ids)
        : { data: [] as { id: string; descricao: string; valor: number }[] };
      const mapa = new Map((desp ?? []).map((d) => [d.id, d]));
      const multIds = (data ?? []).filter((r) => r.tabela_origem === "despesas_multiplas").map((r) => r.id);
      const { data: itens } = multIds.length
        ? await supabase.from("conciliacao_saida_itens").select("conciliacao_id, valor, tipo").eq("ativo", true).in("conciliacao_id", multIds)
        : { data: [] as { conciliacao_id: string; valor: number; tipo: string }[] };
      const resumo = new Map<string, { n: number; soma: number; cred: number }>();
      (itens ?? []).forEach((i) => {
        const r = resumo.get(i.conciliacao_id) ?? { n: 0, soma: 0, cred: 0 };
        resumo.set(i.conciliacao_id, i.tipo === "credito"
          ? { ...r, cred: r.cred + Number(i.valor) }
          : { ...r, n: r.n + 1, soma: r.soma + Number(i.valor) });
      });
      return (data ?? []).map((r) => ({ ...r, despesa: mapa.get(r.registro_id), mult: resumo.get(r.id) }));
    },
  });
  const desfazer = useMutation({
    mutationFn: async (movId: string) => {
      const { error } = await supabase.rpc("fn_desfazer_conciliacao_saida", { p_movimento_id: movId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conciliação desfeita"); qc.invalidateQueries({ queryKey: ["conciliacao-bancaria"] }); qc.invalidateQueries({ queryKey: ["despesas"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao desfazer"),
  });
  if (!q.data?.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Saídas conciliadas ou descartadas manualmente</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Despesa</TableHead><TableHead>Ajuste</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
          <TableBody>
            {q.data.map((r) => (
              <TableRow key={r.movimento_id}>
                <TableCell>{r.tabela_origem === "ignorado" ? `Não é despesa: ${r.motivo ?? ""}`
                  : r.tabela_origem === "despesas_multiplas" ? `Soma de ${r.mult?.n ?? 0} despesas${r.mult?.cred ? ` − ${brl(r.mult.cred)} em créditos` : ""}`
                  : r.despesa?.descricao ?? "—"}</TableCell>
                <TableCell>{r.tabela_origem === "ignorado" ? "—" : r.tabela_origem === "despesas_multiplas" ? brl((r.mult?.soma ?? 0) - (r.mult?.cred ?? 0)) : r.valor_anterior != null
                  ? `${brl(Number(r.valor_anterior))} → ${brl(Number(r.despesa?.valor ?? 0))}`
                  : brl(Number(r.despesa?.valor ?? 0))}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={!canEdit || desfazer.isPending} onClick={() => desfazer.mutate(r.movimento_id)}>Desfazer</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
