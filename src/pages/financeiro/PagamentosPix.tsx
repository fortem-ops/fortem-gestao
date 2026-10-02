import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Send } from "lucide-react";

type Linha = {
  id: string; descricao: string; valor: number; valor_liquido_previsto: number | null; data_competencia: string | null; status: string;
  pix_status: string | null; pix_erro: string | null; pix_codigo_solicitacao: string | null; data_pagamento: string | null; pix_data_agendada: string | null;
  fornecedor: { id: string; nome: string; chave_pix: string | null } | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const hojeISO = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const valorDe = (l: Linha) => Number(l.valor_liquido_previsto ?? l.valor);
const mesDe = (l: Linha) => l.data_competencia?.slice(0, 7) ?? "9999-99";
const rotuloMes = (chave: string) => {
  const [, m, a] = chave.match(/^(\d{4})-(\d{2})$/) ?? [];
  return m ? `${MESES_PT[Number(m) - 1]} ${a}` : "Sem competência";
};
function agruparPorMes(linhas: Linha[]) {
  const mapa = new Map<string, Linha[]>();
  for (const l of linhas) { const k = mesDe(l); const g = mapa.get(k); if (g) g.push(l); else mapa.set(k, [l]); }
  return [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, ls]) => ({ mes, linhas: ls, total: ls.reduce((s, l) => s + valorDe(l), 0) }));
}

export function mascararChave(c: string) {
  const s = c.trim();
  const dig = s.replace(/\D/g, "");
  if (/^\d{11}$/.test(s.replace(/[.\-\s]/g, "")) && !s.startsWith("+")) return `***.***.**${dig[8]}-${dig.slice(9)}`;
  if (s.includes("@")) { const [u, d] = s.split("@"); return `${u.slice(0, 2)}***@${d}`; }
  return `***${s.slice(-4)}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  AGUARDANDO_ENVIO: { label: "Enviando", cls: "status-info" },
  AGUARDANDO_APROVACAO: { label: "Aguardando aprovação no app Inter", cls: "status-warning" },
  CONCLUIDO: { label: "Pago", cls: "status-active" },
  REJEITADO: { label: "Rejeitado", cls: "status-urgent" },
  ERRO: { label: "Erro", cls: "status-urgent" },
};

export default function PagamentosPix() {
  const { data: roles, isLoading: carregandoRoles } = useUserRoles();
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [datas, setDatas] = useState<Record<string, string>>({});

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["pagamentos-pix"],
    enabled: !!roles?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas")
        .select("id, descricao, valor, valor_liquido_previsto, data_competencia, status, pix_status, pix_erro, pix_codigo_solicitacao, data_pagamento, pix_data_agendada, fornecedor:fornecedores(id, nome, chave_pix)")
        .or("and(status.eq.pendente,forma_pagamento.eq.PIX),pix_status.not.is.null")
        .order("data_competencia", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  const { elegiveis, semChave, semFornecedor, acompanhamento } = useMemo(() => {
    const pend = linhas.filter((l) => l.status === "pendente" && (!l.pix_status || ["ERRO", "REJEITADO"].includes(l.pix_status)));
    return {
      elegiveis: pend.filter((l) => l.fornecedor?.chave_pix?.trim()),
      semChave: pend.filter((l) => l.fornecedor && !l.fornecedor.chave_pix?.trim()),
      semFornecedor: pend.filter((l) => !l.fornecedor),
      acompanhamento: linhas.filter((l) => l.pix_status && !(l.status === "pendente" && ["ERRO", "REJEITADO"].includes(l.pix_status)))
        .sort((a, b) => (b.data_pagamento ?? "9").localeCompare(a.data_pagamento ?? "9")).slice(0, 100),
    };
  }, [linhas]);

  const gruposElegiveis = useMemo(() => agruparPorMes(elegiveis), [elegiveis]);
  const gruposSemChave = useMemo(() => agruparPorMes([...semChave, ...semFornecedor]), [semChave, semFornecedor]);

  const selecionadas = elegiveis.filter((l) => sel.has(l.id));
  const total = selecionadas.reduce((s, l) => s + valorDe(l), 0);
  const hoje = hojeISO();
  // Padrão = data de competência (nunca antes de hoje, que o Inter não aceita)
  const dataDe = (l: Linha) => datas[l.id] ?? (l.data_competencia && l.data_competencia >= hoje ? l.data_competencia : hoje);
  const datasLote = [...new Set(selecionadas.map(dataDe))].sort();
  const dataInvalida = selecionadas.some((l) => !dataDe(l) || dataDe(l) < hoje);

  const enviar = useMutation({
    mutationFn: async (pagamentos: { despesa_id: string; data_pagamento: string }[]) => {
      const { data, error } = await supabase.functions.invoke("enviar-pagamentos-pix", { body: { pagamentos } });
      if (error) throw error;
      return data as { enviados: number; concluidos: number; erros: number; ignorados: number };
    },
    onSuccess: (r) => {
      toast.success(`${r.enviados} enviado(s)${r.erros ? `, ${r.erros} com erro` : ""}${r.ignorados ? `, ${r.ignorados} ignorado(s)` : ""}. Aprove no app Inter Empresas.`);
      setSel(new Set());
      setDatas({});
      qc.invalidateQueries({ queryKey: ["pagamentos-pix"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar"),
    onSettled: () => setConfirmar(false),
  });

  const verificar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("verificar-pagamentos-pix-diario", { body: {} });
      if (error) throw error;
      return data as { verificados: number; concluidos: number; rejeitados: number; aguardando: number };
    },
    onSuccess: (r) => {
      toast.success(`${r.verificados} verificado(s): ${r.concluidos} pago(s), ${r.rejeitados} rejeitado(s), ${r.aguardando} aguardando.`);
      qc.invalidateQueries({ queryKey: ["pagamentos-pix"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao verificar"),
  });

  if (carregandoRoles) return null;
  if (!roles?.isAdmin) return <Navigate to="/" replace />;

  const toggle = (id: string, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  const todos = elegiveis.length > 0 && selecionadas.length === elegiveis.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold">Pagamentos Pix</h1>
          <p className="text-sm text-muted-foreground">Envie despesas pendentes pelo Banco Inter. Cada pagamento precisa ser aprovado no app Inter Empresas; a baixa acontece sozinha depois.</p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={() => verificar.mutate()} disabled={verificar.isPending}>
          <RefreshCw className={`h-4 w-4 mr-1 ${verificar.isPending ? "animate-spin" : ""}`} /> Verificar aprovações agora
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-base">Prontas para enviar ({elegiveis.length})</CardTitle>
          <Button className="ml-auto" disabled={selecionadas.length === 0 || dataInvalida || enviar.isPending} onClick={() => setConfirmar(true)}>
            <Send className="h-4 w-4 mr-1" /> Confirmar e Enviar Pagamentos{selecionadas.length ? ` (${selecionadas.length} · ${brl(total)})` : ""}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={todos} onCheckedChange={(v) => setSel(v ? new Set(elegiveis.map((l) => l.id)) : new Set())} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Fornecedor / funcionário</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Pagar em</TableHead>
                <TableHead>Chave Pix</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elegiveis.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Checkbox checked={sel.has(l.id)} onCheckedChange={(v) => toggle(l.id, !!v)} aria-label={`Selecionar ${l.descricao}`} /></TableCell>
                  <TableCell>{l.fornecedor?.nome}</TableCell>
                  <TableCell>
                    {l.descricao}
                    {l.pix_status && <Badge className={`ml-2 ${STATUS[l.pix_status]?.cls}`} title={l.pix_erro ?? ""}>{STATUS[l.pix_status]?.label}</Badge>}
                    {l.pix_erro && <p className="text-xs text-destructive">{l.pix_erro}</p>}
                  </TableCell>
                  <TableCell>{dataBR(l.data_competencia)}</TableCell>
                  <TableCell>
                    <Input type="date" className="h-8 w-[150px]" min={hoje} value={dataDe(l)} aria-label={`Data de pagamento de ${l.descricao}`}
                      onChange={(e) => setDatas((m) => ({ ...m, [l.id]: e.target.value }))} />
                    {dataDe(l) < hoje && <p className="text-xs text-destructive">Data passada</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{mascararChave(l.fornecedor!.chave_pix!)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(l.valor_liquido_previsto ?? l.valor))}</TableCell>
                </TableRow>
              ))}
              {!isLoading && elegiveis.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma despesa Pix pendente com chave cadastrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(semChave.length > 0 || semFornecedor.length > 0) && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Sem chave Pix cadastrada ({semChave.length + semFornecedor.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {[...semChave, ...semFornecedor].map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.fornecedor?.nome ?? <span className="text-muted-foreground">Sem fornecedor vinculado</span>}</TableCell>
                    <TableCell>{l.descricao}</TableCell>
                    <TableCell>{dataBR(l.data_competencia)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(l.valor_liquido_previsto ?? l.valor))}</TableCell>
                    <TableCell className="text-right">
                      <Link className="text-primary text-sm underline" to="/financeiro/despesas?aba=fornecedores">
                        {l.fornecedor ? "Cadastrar chave Pix" : "Vincular fornecedor"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Acompanhamento</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Situação</TableHead>
                <TableHead>Pago / agendado em</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acompanhamento.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.fornecedor?.nome ?? "—"}</TableCell>
                  <TableCell>{l.descricao}</TableCell>
                  <TableCell><Badge className={STATUS[l.pix_status!]?.cls}>{STATUS[l.pix_status!]?.label ?? l.pix_status}</Badge></TableCell>
                  <TableCell>{l.data_pagamento ? dataBR(l.data_pagamento) : l.pix_data_agendada ? `Agendado ${dataBR(l.pix_data_agendada)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(l.valor_liquido_previsto ?? l.valor))}</TableCell>
                </TableRow>
              ))}
              {!isLoading && acompanhamento.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum pagamento enviado ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmar} onOpenChange={(o) => !enviar.isPending && setConfirmar(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o envio de {selecionadas.length} pagamento(s) totalizando {brl(total)}? Eles serão enviados ao Banco Inter e precisarão ser aprovados no app Inter Empresas.
            </AlertDialogDescription>
            {datasLote.length === 1 ? (
              <p className="text-sm">Data de pagamento: <strong>{dataBR(datasLote[0])}</strong></p>
            ) : (
              <div className="text-sm">
                <p>Datas de pagamento:</p>
                <ul className="list-disc pl-5">
                  {datasLote.map((d) => {
                    const ls = selecionadas.filter((l) => dataDe(l) === d);
                    return <li key={d}><strong>{dataBR(d)}</strong> — {ls.length} pagamento(s), {brl(ls.reduce((s, l) => s + Number(l.valor_liquido_previsto ?? l.valor), 0))}</li>;
                  })}
                </ul>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={enviar.isPending} onClick={(e) => { e.preventDefault(); enviar.mutate(selecionadas.map((l) => ({ despesa_id: l.id, data_pagamento: dataDe(l) }))); }}>
              {enviar.isPending ? "Enviando…" : "Confirmar envio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
