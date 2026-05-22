import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Activity, Utensils, Footprints, Calendar, DollarSign, Clock, Pencil, Check, X, Plus, History, Trash2, RefreshCw, Ban, ShoppingCart, Edit3 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { StudentServicos } from "./StudentServicos";
import { StudentLicencas } from "./StudentLicencas";
import { isAutoRenewPlan } from "@/lib/planTipo";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { VendaDialog } from "./venda/VendaDialog";
import { HistoricoVendas } from "./venda/HistoricoVendas";
import { useFormasPagamento } from "./venda/PaymentFields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import { useCancelamentoMotivos, useCancelamentoMotivoMutations } from "@/hooks/useCancelamentoMotivos";

function parseServiceCount(servicos: string[], tipoServico: string): number {
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
  }
  return 0;
}

function updateServiceCount(servicos: string[], tipoServico: string, newCount: number): string[] {
  const updated = servicos.filter((s) => {
    const match = s.match(/^(\d+)\s+(.+)$/);
    return !(match && match[2] === tipoServico);
  });
  if (newCount > 0) {
    updated.push(`${newCount} ${tipoServico}`);
  }
  return updated;
}

function calcEndDate(startDate: string, durationMonths: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + durationMonths);
  return d.toLocaleDateString("pt-BR");
}

const SERVICE_TYPES = [
  { key: "avalFuncional", label: "Avaliação Funcional", dbLabel: "Avaliação Funcional", icon: Activity },
  { key: "nutricao", label: "Consultas Nutrição", dbLabel: "Consultas Nutrição", icon: Utensils },
  { key: "reabilitacao", label: "Consultas Reabilitação", dbLabel: "Consultas Reabilitação", icon: Footprints },
];

export function StudentPlan({ student }: { student: Tables<"alunos"> }) {
  const queryClient = useQueryClient();
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [historyService, setHistoryService] = useState<string | null>(null);
  const [addUsageOpen, setAddUsageOpen] = useState(false);
  const [addUsageService, setAddUsageService] = useState("");
  const [addUsageDate, setAddUsageDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendaOpen, setVendaOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelDate, setCancelDate] = useState(new Date().toISOString().split("T")[0]);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editTipo, setEditTipo] = useState("");
  const [editValor, setEditValor] = useState<string>("");
  const [editInicio, setEditInicio] = useState("");
  const [editDuracao, setEditDuracao] = useState<number>(1);
  const [editFim, setEditFim] = useState<string>("");
  const [editDescRec, setEditDescRec] = useState<string>("");
  const [editFormaRec, setEditFormaRec] = useState<string | null>(null);
  const [editParcelasRec, setEditParcelasRec] = useState<number>(1);
  const { data: formasPag = [] } = useFormasPagamento();

  const { data: isCoordAdmin = false } = useQuery({
    queryKey: ["is_coord_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
      return !!data;
    },
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is_admin_plan"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      return !!data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["plano_ativo", student.id],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!planos || planos.length === 0) return null;
      const plano = planos[0];

      const { data: consumos } = await supabase
        .from("consumo_servicos")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("plano_id", plano.id)
        .order("data_consumo", { ascending: false });

      const servicos = plano.servicos || [];

      const countPurchased = (tipo: string) =>
        consumos?.filter((c: any) => c.tipo_servico === tipo && c.tipo_registro === "compra")
          .reduce((sum: number, c: any) => sum + (c.quantidade ?? 1), 0) || 0;

      const countUsed = (tipo: string) =>
        consumos?.filter((c: any) => c.tipo_servico === tipo && (!!c.agenda_id || c.tipo_registro === "uso_manual")).length || 0;

      const buildCredit = (tipo: string) => ({
        base: parseServiceCount(servicos, tipo),
        comprado: countPurchased(tipo),
        total: parseServiceCount(servicos, tipo) + countPurchased(tipo),
        usado: countUsed(tipo),
      });

      return {
        ...plano,
        consumos: consumos || [],
        credits: {
          avalFuncional: buildCredit("Avaliação Funcional"),
          nutricao: buildCredit("Consultas Nutrição"),
          reabilitacao: buildCredit("Consultas Reabilitação"),
        },
      };
    },
  });

  async function handleSaveCredit(dbLabel: string) {
    if (!data) return;
    setSaving(true);
    try {
      const newServicos = updateServiceCount(data.servicos || [], dbLabel, editValue);
      const { error } = await supabase
        .from("planos")
        .update({ servicos: newServicos })
        .eq("id", data.id);
      if (error) throw error;
      toast.success("Créditos atualizados");
      invalidatePlanoCaches(queryClient, student.id);
      setEditingService(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar créditos");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUsage() {
    if (!data || !addUsageService) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("consumo_servicos").insert({
        aluno_id: student.id,
        plano_id: data.id,
        tipo_servico: addUsageService,
        data_consumo: addUsageDate,
        quantidade: 1,
        valor_unitario: 0,
        registrado_por: user.id,
        tipo_registro: "uso_manual",
      } as any);
      if (error) throw error;
      toast.success("Utilização registrada");
      invalidatePlanoCaches(queryClient, student.id);
      setAddUsageOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar utilização");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUsage(id: string) {
    try {
      const { error } = await supabase.from("consumo_servicos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro removido");
      invalidatePlanoCaches(queryClient, student.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover registro");
    }
  }

  async function handleCancelContract() {
    if (!data) return;
    if (!cancelDate) { toast.error("Selecione a data de cancelamento"); return; }
    const today = new Date().toISOString().split("T")[0];
    if (cancelDate < today) { toast.error("Data não pode ser no passado"); return; }
    const isScheduled = cancelDate > today;
    setSaving(true);
    try {
      const motivoTxt = cancelMotivo.trim()
        ? `\n\n[Cancelamento ${isScheduled ? "agendado para " + new Date(cancelDate + "T00:00:00").toLocaleDateString("pt-BR") : "imediato"}]: ${cancelMotivo.trim()}`
        : "";
      const novaObs = ((data as any).observacoes || "") + motivoTxt;
      const payload: any = {
        renovacao_automatica: false,
        data_fim: cancelDate,
        observacoes: novaObs || null,
      };
      if (!isScheduled) payload.ativo = false;
      const { error } = await supabase.from("planos").update(payload).eq("id", data.id);
      if (error) throw error;
      toast.success(isScheduled ? `Cancelamento agendado para ${new Date(cancelDate + "T00:00:00").toLocaleDateString("pt-BR")}` : "Contrato cancelado");
      invalidatePlanoCaches(queryClient, student.id);
      setCancelOpen(false);
      setCancelMotivo("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar contrato");
    } finally {
      setSaving(false);
    }
  }

  function openEditPlan() {
    if (!data) return;
    const d: any = data;
    setEditTipo(d.tipo ?? "");
    setEditValor(d.valor != null ? String(d.valor) : "");
    setEditInicio(d.data_inicio ?? "");
    setEditDuracao(d.duracao_meses ?? 1);
    setEditFim(d.data_fim ?? "");
    setEditDescRec(d.desconto_recorrente != null ? String(d.desconto_recorrente) : "");
    setEditFormaRec(d.forma_pagamento_padrao ?? null);
    setEditParcelasRec(d.parcelas_padrao ?? 1);
    setEditPlanOpen(true);
  }

  async function handleSavePlan() {
    if (!data) return;
    if (!editTipo.trim()) { toast.error("Tipo é obrigatório"); return; }
    if (!editInicio) { toast.error("Data de início é obrigatória"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("planos")
        .update({
          tipo: editTipo.trim(),
          valor: editValor === "" ? 0 : Number(editValor),
          data_inicio: editInicio,
          duracao_meses: editDuracao,
          data_fim: editFim || null,
          desconto_recorrente: editDescRec === "" ? 0 : Number(editDescRec),
          forma_pagamento_padrao: editFormaRec,
          parcelas_padrao: editParcelasRec || 1,
        } as any)
        .eq("id", data.id);
      if (error) throw error;
      toast.success("Plano atualizado");
      invalidatePlanoCaches(queryClient, student.id);
      setEditPlanOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar plano");
    } finally {
      setSaving(false);
    }
  }


  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
          <Button size="sm" onClick={() => setVendaOpen(true)} className="gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Venda
          </Button>
        </div>
        <div className="glass-card rounded-lg p-5">
          <p className="text-sm text-muted-foreground">Nenhum plano ativo encontrado para este aluno.</p>
        </div>
        <HistoricoVendas alunoId={student.id} />
        <VendaDialog alunoId={student.id} alunoNome={student.nome} open={vendaOpen} onOpenChange={setVendaOpen} />
      </div>
    );
  }

  const serviceItems = SERVICE_TYPES.map((st) => ({
    ...st,
    credit: data.credits[st.key as keyof typeof data.credits],
  }));

  const visibleServices = isAdmin
    ? serviceItems
    : serviceItems.filter((s) => s.credit.total > 0);

  const getUsageHistory = (dbLabel: string) =>
    (data.consumos as any[]).filter(
      (c) => c.tipo_servico === dbLabel && (!!c.agenda_id || c.tipo_registro === "uso_manual")
    );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
        <Button size="sm" onClick={() => setVendaOpen(true)} className="gap-1.5">
          <ShoppingCart className="w-4 h-4" /> Venda
        </Button>
      </div>
      <div className="glass-card rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="text-sm px-3 py-1">{data.tipo}</Badge>
            <Badge variant="outline" className="status-active">Ativo</Badge>
            {((data as any).renovacao_automatica || isAutoRenewPlan(data.tipo)) && (
              <Badge variant="outline" className="status-info gap-1">
                <RefreshCw className="h-3 w-3" /> Renovação automática mensal
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data.valor != null && data.valor > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>R$ {Number(data.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {isCoordAdmin && (
              <Button size="sm" variant="outline" onClick={openEditPlan} disabled={saving} className="gap-1.5">
                <Edit3 className="h-3.5 w-3.5" /> Editar Plano
              </Button>
            )}
            {isCoordAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                disabled={saving}
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setCancelDate((data as any).data_fim && (data as any).data_fim >= today ? (data as any).data_fim : today);
                  setCancelMotivo("");
                  setCancelOpen(true);
                }}
              >
                <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancelar Contrato
              </Button>
            )}
          </div>
        </div>

        {(() => {
          const today = new Date().toISOString().split("T")[0];
          const df = (data as any).data_fim;
          if (df && df > today && (data as any).renovacao_automatica === false) {
            return (
              <Badge variant="outline" className="status-warning gap-1.5 w-fit">
                <Ban className="h-3 w-3" />
                Cancelamento agendado para {new Date(df + "T00:00:00").toLocaleDateString("pt-BR")}
              </Badge>
            );
          }
          return null;
        })()}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Início</p>
              <p className="font-medium text-foreground">{new Date(data.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Término</p>
              <p className="font-medium text-foreground">
                {(data as any).data_fim
                  ? new Date((data as any).data_fim + "T00:00:00").toLocaleDateString("pt-BR")
                  : calcEndDate(data.data_inicio, data.duracao_meses)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Duração</p>
              <p className="font-medium text-foreground">{data.duracao_meses} {data.duracao_meses === 1 ? "mês" : "meses"}</p>
            </div>
          </div>
          {(data as any).renovacao_automatica && (data as any).proxima_renovacao && (
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Próxima renovação</p>
                <p className="font-medium text-foreground">
                  {new Date((data as any).proxima_renovacao + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          )}
        </div>

        {visibleServices.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Créditos de Serviços</p>
            <div className="space-y-2">
              {visibleServices.map((s) => {
                const restante = s.credit.total - s.credit.usado;
                const isEditing = editingService === s.dbLabel;
                const showHistory = historyService === s.dbLabel;
                const history = getUsageHistory(s.dbLabel);

                const hasCredit = restante > 0;
                const rowClass = s.credit.total === 0
                  ? "border-border/50 bg-muted/20"
                  : hasCredit
                    ? "border-success/40 bg-success/10"
                    : "border-destructive/40 bg-destructive/10";

                return (
                  <div key={s.label} className="space-y-0">
                    <div className={`flex items-center justify-between rounded-md border px-4 py-2.5 ${rowClass}`}>
                      <div className="flex items-center gap-2">
                        <s.icon className={`h-4 w-4 ${s.credit.total === 0 ? "text-muted-foreground" : hasCredit ? "text-success" : "text-destructive"}`} />
                        <span className="text-sm text-foreground">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">Base:</span>
                            <Input
                              type="number"
                              min={0}
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" disabled={saving} onClick={() => handleSaveCredit(s.dbLabel)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingService(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            {s.credit.base > 0 && <span>Plano: {s.credit.base}</span>}
                            {s.credit.comprado > 0 && <span className="text-primary">+{s.credit.comprado} comprado{s.credit.comprado !== 1 ? "s" : ""}</span>}
                            <span className="text-sm font-medium text-foreground">{s.credit.usado}/{s.credit.total} usados</span>
                            <Badge variant="outline" className={`text-xs ${restante > 0 ? "status-active" : "status-urgent"}`}>
                              {restante > 0 ? `${restante} disponível${restante !== 1 ? "eis" : ""}` : "Esgotado"}
                            </Badge>
                            {isAdmin && (
                              <div className="flex items-center gap-1 ml-1">
                                <button
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={() => { setEditingService(s.dbLabel); setEditValue(s.credit.base); }}
                                  title="Editar créditos base"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={() => { setAddUsageService(s.dbLabel); setAddUsageDate(new Date().toISOString().split("T")[0]); setAddUsageOpen(true); }}
                                  title="Registrar utilização"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={() => setHistoryService(showHistory ? null : s.dbLabel)}
                                  title="Histórico de utilização"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {showHistory && (
                      <div className="border border-t-0 border-border/50 rounded-b-md bg-muted/10 px-4 py-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Histórico de utilização</p>
                        {history.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma utilização registrada.</p>
                        ) : (
                          history.map((h: any) => (
                            <div key={h.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-foreground">
                                  {new Date(h.data_consumo + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {h.agenda_id ? "Agenda" : "Manual"}
                                </Badge>
                                {h.observacoes && <span className="text-muted-foreground">{h.observacoes}</span>}
                              </div>
                              {isAdmin && h.tipo_registro === "uso_manual" && (
                                <button
                                  className="text-destructive hover:text-destructive/80 transition-colors"
                                  onClick={() => handleDeleteUsage(h.id)}
                                  title="Remover"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Créditos são consumidos ao agendar o serviço na agenda.</p>
          </div>
        )}

        <StudentLicencas alunoId={student.id} planoId={data.id} planoTipo={data.tipo} isCoordAdmin={isCoordAdmin} />
      </div>
      <p className="text-xs text-muted-foreground">Editável apenas por Coordenação e Administração</p>

      <Dialog open={addUsageOpen} onOpenChange={setAddUsageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Utilização de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Input value={addUsageService} disabled />
            </div>
            <div className="space-y-2">
              <Label>Data de Utilização</Label>
              <Input type="date" value={addUsageDate} onChange={(e) => setAddUsageDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUsageOpen(false)}>Cancelar</Button>
            <Button disabled={saving || !addUsageDate} onClick={handleAddUsage}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentServicos student={student} isCoordAdmin={isCoordAdmin} />

      <HistoricoVendas alunoId={student.id} />
      <VendaDialog alunoId={student.id} alunoNome={student.nome} open={vendaOpen} onOpenChange={setVendaOpen} />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O plano <strong>{data.tipo}</strong> deixará de ter renovação automática. Escolha a data efetiva do cancelamento — se for uma data futura, o cancelamento ficará agendado e o plano permanecerá ativo até lá.
            </p>
            <div className="space-y-2">
              <Label>Data de cancelamento</Label>
              <Input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={cancelDate}
                onChange={(e) => setCancelDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                placeholder="Ex.: aluno solicitou pausa"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              disabled={saving || !cancelDate}
              onClick={handleCancelContract}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelDate > new Date().toISOString().split("T")[0] ? "Agendar cancelamento" : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPlanOpen} onOpenChange={setEditPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano Contratado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo do plano</Label>
              <Input value={editTipo} onChange={(e) => setEditTipo(e.target.value)} placeholder="Ex.: Start, Pro, Max" />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} value={editValor} onChange={(e) => setEditValor(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input type="date" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duração (meses)</Label>
                <Input type="number" min={1} value={editDuracao} onChange={(e) => setEditDuracao(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de término (opcional)</Label>
              <Input type="date" value={editFim} onChange={(e) => setEditFim(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe em branco para usar o término calculado pela duração.</p>
            </div>
            {((data as any)?.renovacao_automatica || isAutoRenewPlan(editTipo)) && (
              <>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Este plano possui <strong>renovação automática mensal</strong>. Para encerrar a renovação, use "Cancelar Contrato".</span>
                </div>

                <div className="rounded-md border border-border p-3 space-y-3">
                  <p className="text-sm font-medium text-foreground">Cobrança recorrente (próximas renovações)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Forma de pagamento padrão</Label>
                      <Select value={editFormaRec ?? ""} onValueChange={(v) => {
                        setEditFormaRec(v || null);
                        const f = formasPag.find((x) => x.slug === v);
                        if (!f?.permite_parcelamento) setEditParcelasRec(1);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {formasPag.map((f) => (
                            <SelectItem key={f.id} value={f.slug}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Desconto recorrente (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={editDescRec}
                        onChange={(e) => setEditDescRec(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  {(() => {
                    const f = formasPag.find((x) => x.slug === editFormaRec);
                    if (!f?.permite_parcelamento) return null;
                    return (
                      <div className="space-y-2">
                        <Label>Parcelas padrão</Label>
                        <Select value={String(editParcelasRec)} onValueChange={(v) => setEditParcelasRec(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    Aplicado automaticamente em cada renovação mensal gerada pelo sistema.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={handleSavePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
