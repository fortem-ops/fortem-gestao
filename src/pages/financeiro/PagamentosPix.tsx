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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Send } from "lucide-react";

type Linha = {
  id: string; descricao: string; valor: number; data_competencia: string | null; status: string;
  pix_status: string | null; pix_erro: string | null; pix_codigo_solicitacao: string | null; data_pagamento: string | null;
  fornecedor: { id: string; nome: string; chave_pix: string | null } | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export function mascararChave(c: string) {
  const s = c.trim();
  const dig = s.replace(/\D/g, "");
  if (/^\d{11}$/.test(dig) && !s.includes("@") && !s.startsWith("+")) return `***.***.**${dig.slice(8, 9)}-${dig.slice(9)}`.replace(/^(.{0,})$/, (m) => m).replace(/\*\*(\d)-/, `*$1-`);
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

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["pagamentos-pix"],
    enabled: !!roles?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas")
        .select("id, descricao, valor, data_competencia, status, pix_status, pix_erro, pix_codigo_solicitacao, data_pagamento, fornecedor:fornecedores(id, nome, chave_pix)")
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

  const selecionadas = elegiveis.filter((l) => sel.has(l.id));
  const total = selecionadas.reduce((s, l) => s + Number(l.valor), 0);

  const enviar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("enviar-pagamentos-pix", { body: { despesa_ids: ids } });
      if (error) throw error;
      return data as { enviados: number; concluidos: number; erros: number; ignorados: number };
    },
    onSuccess: (r) => {
      toast.success(`${r.enviados} enviado(s)${r.erros ? `, ${r.erros} com erro` : ""}${r.ignorados ? `, ${r.ignorados} ignorado(s)` : ""}. Aprove no app Inter Empresas.`);
      setSel(new Set());
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
          <Button className="ml-auto" disabled={selecionadas.length === 0 || enviar.isPending} onClick={() => setConfirmar(true)}>
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
                  <TableCell className="font-mono text-xs">{mascararChave(l.fornecedor!.chave_pix!)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(l.valor))}</TableCell>
                </TableRow>
              ))}
              {!isLoading && elegiveis.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma despesa Pix pendente com chave cadastrada.</TableCell></TableRow>
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
                    <TableCell className="text-right tabular-nums">{brl(Number(l.valor))}</TableCell>
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
                <TableHead>Pago em</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acompanhamento.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.fornecedor?.nome ?? "—"}</TableCell>
                  <TableCell>{l.descricao}</TableCell>
                  <TableCell><Badge className={STATUS[l.pix_status!]?.cls}>{STATUS[l.pix_status!]?.label ?? l.pix_status}</Badge></TableCell>
                  <TableCell>{dataBR(l.data_pagamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(l.valor))}</TableCell>
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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={enviar.isPending} onClick={(e) => { e.preventDefault(); enviar.mutate(selecionadas.map((l) => l.id)); }}>
              {enviar.isPending ? "Enviando…" : "Confirmar envio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
