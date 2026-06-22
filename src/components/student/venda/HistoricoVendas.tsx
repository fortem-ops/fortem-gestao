import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { History, RefreshCw, Pencil, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";
import { PaymentFields, useFormasPagamento } from "./PaymentFields";
import { PagarCartaoDialog } from "@/components/pagamentos/PagarCartaoDialog";

type Props = { alunoId: string };

const statusColor: Record<string, string> = {
  pago: "status-active",
  pendente: "status-warning",
  cancelado: "status-urgent",
  falha: "status-urgent",
  estornado: "status-info",
};

export function HistoricoVendas({ alunoId }: Props) {
  const qc = useQueryClient();
  const { data: formas = [] } = useFormasPagamento();

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas-aluno", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendas")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data_venda", { ascending: false });
      return data || [];
    },
  });

  const { data: vendedores = {} } = useQuery({
    queryKey: ["vendas-vendedores", vendas.map((v: any) => v.vendedor_id).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(vendas.map((v: any) => v.vendedor_id).filter(Boolean)));
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: vendas.length > 0,
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ["creditos-aluno", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("creditos_aluno").select("*").eq("aluno_id", alunoId);
      return data || [];
    },
  });

  const planoIds = Array.from(new Set(vendas.map((v: any) => v.plano_id).filter(Boolean))) as string[];
  const { data: planosMap = {} } = useQuery<Record<string, { data_fim: string | null; ativo: boolean }>>({
    queryKey: ["vendas-planos", alunoId, planoIds.join(",")],
    queryFn: async () => {
      if (planoIds.length === 0) return {};
      const { data } = await (supabase as any).from("planos").select("id, data_fim, ativo").in("id", planoIds);
      const map: Record<string, { data_fim: string | null; ativo: boolean }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { data_fim: p.data_fim, ativo: p.ativo }; });
      return map;
    },
    enabled: planoIds.length > 0,
  });

  const { data: isCoordAdmin = false } = useQuery({
    queryKey: ["is_coord_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
      return !!data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("vendas").update({ status_pagamento: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit payment dialog
  const [editing, setEditing] = useState<any | null>(null);
  const [editDesconto, setEditDesconto] = useState(0);
  const [editForma, setEditForma] = useState<string | null>(null);
  const [editParcelas, setEditParcelas] = useState(1);
  const [editStatus, setEditStatus] = useState<string>("pendente");
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(v: any) {
    setEditing(v);
    setEditDesconto(Number(v.desconto || 0));
    setEditForma(v.forma_pagamento ?? null);
    setEditParcelas(Number(v.parcelas || 1));
    setEditStatus(v.status_pagamento ?? "pendente");
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const valor = Number(editing.valor || 0);
      const valorFinal = Math.max(0, valor - (editDesconto || 0));
      const { error } = await (supabase as any).from("vendas").update({
        desconto: editDesconto || 0,
        valor_final: valorFinal,
        forma_pagamento: editForma,
        parcelas: editParcelas || 1,
        status_pagamento: editStatus,
      }).eq("id", editing.id);
      if (error) throw error;
      toast.success("Pagamento atualizado");
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar pagamento");
    } finally {
      setSavingEdit(false);
    }
  }

  function creditoRestante(venda: any): string {
    const c = creditos.find((c: any) => c.origem_id === venda.id);
    if (!c) return "—";
    if (c.ilimitado) return "Ilimitado";
    return `${(c.quantidade_inicial || 0) - (c.quantidade_usada || 0)} / ${c.quantidade_inicial}`;
  }

  function nomeForma(slug: string | null) {
    if (!slug) return null;
    return formas.find((f) => f.slug === slug)?.nome || slug;
  }

  return (
    <div className="space-y-3 mt-6">
      <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
        <History className="w-4 h-4" /> Histórico de Vendas
      </h3>
      <div className="glass-card rounded-lg overflow-hidden">
        {isLoading ? <Skeleton className="h-24 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Créditos</TableHead>
                {isCoordAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v: any) => {
                const desc = Number(v.desconto || 0);
                const valor = Number(v.valor || 0);
                const final = Number(v.valor_final ?? valor);
                const forma = nomeForma(v.forma_pagamento);
                return (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.data_venda + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{v.tipo}</Badge>
                        {v.origem === "renovacao_automatica" && (
                          <Badge variant="outline" className="status-info gap-1 text-[10px]">
                            <RefreshCw className="w-2.5 h-2.5" /> Auto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col leading-tight">
                        <span>{v.nome_snapshot}</span>
                        {v.tipo === "plano" && v.plano_id && planosMap[v.plano_id]?.data_fim && (() => {
                          const p = planosMap[v.plano_id];
                          const dataFim = p.data_fim as string;
                          const today = new Date().toISOString().split("T")[0];
                          const isFuture = dataFim > today;
                          return (
                            <span className={`text-[11px] ${isFuture ? "text-muted-foreground" : "text-destructive"}`}>
                              {isFuture ? "Cancelamento agendado: " : "Cancelado em: "}
                              {new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {desc > 0 ? (
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs text-muted-foreground line-through">{formatBRL(valor)}</span>
                          <span className="font-medium text-foreground">{formatBRL(final)}</span>
                        </div>
                      ) : (
                        <span>{formatBRL(valor)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {forma ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{forma}</Badge>
                          {Number(v.parcelas || 1) > 1 && (
                            <Badge variant="outline" className="text-[10px]">{v.parcelas}x</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{vendedores[v.vendedor_id] || "—"}</TableCell>
                    <TableCell>
                      {isCoordAdmin ? (
                        <Select value={v.status_pagamento} onValueChange={(s) => updateStatus.mutate({ id: v.id, status: s })}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={statusColor[v.status_pagamento]}>{v.status_pagamento}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{creditoRestante(v)}</TableCell>
                    {isCoordAdmin && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(v)} title="Editar pagamento">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={isCoordAdmin ? 9 : 8} className="text-center text-muted-foreground py-6">Nenhuma venda registrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{editing.nome_snapshot}</span> · {formatBRL(Number(editing.valor || 0))}
              </div>

              <PaymentFields
                valorBase={Number(editing.valor || 0)}
                desconto={editDesconto}
                onDescontoChange={setEditDesconto}
                formaPagamentoSlug={editForma}
                onFormaPagamentoChange={setEditForma}
                parcelas={editParcelas}
                onParcelasChange={setEditParcelas}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Status do pagamento</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={savingEdit} onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
