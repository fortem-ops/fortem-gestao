import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Pencil, Users, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toastSuccess, toastError } from "@/lib/toast-helpers";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Slot = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  capacidade_maxima: number;
  instrutor_id: string | null;
  ativo: boolean;
  observacoes: string | null;
};

type Profile = { user_id: string; full_name: string };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function SlotDialog({
  open,
  onOpenChange,
  slot,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot: Slot | null;
  profiles: Profile[];
  onSaved: () => void;
}) {
  const isEdit = !!slot;
  const [form, setForm] = useState({
    dias: slot ? [slot.dia_semana] : [1],
    horario_inicio: slot?.horario_inicio?.slice(0, 5) ?? "07:00",
    horario_fim: slot?.horario_fim?.slice(0, 5) ?? "08:00",
    capacidade_maxima: slot?.capacidade_maxima ?? 8,
    instrutor_id: slot?.instrutor_id ?? "",
    observacoes: slot?.observacoes ?? "",
  });

  const toggleDia = (i: number) => {
    if (isEdit) return;
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(i) ? f.dias.filter((d) => d !== i) : [...f.dias, i].sort(),
    }));
  };

  const save = useSupabaseMutation({
    mutationFn: async () => {
      if (toMinutes(form.horario_fim) <= toMinutes(form.horario_inicio)) {
        throw new Error("Horário final deve ser maior que o inicial");
      }
      if (!isEdit && form.dias.length === 0) {
        throw new Error("Selecione ao menos um dia da semana");
      }
      const base = {
        horario_inicio: form.horario_inicio,
        horario_fim: form.horario_fim,
        capacidade_maxima: form.capacidade_maxima,
        instrutor_id: form.instrutor_id || null,
        observacoes: form.observacoes || null,
      };
      if (isEdit) {
        const { error } = await supabase
          .from("treino_slots")
          .update({ ...base, dia_semana: form.dias[0] })
          .eq("id", slot!.id);
        if (error) throw error;
        return 1;
      } else {
        const payloads = form.dias.map((d) => ({ ...base, dia_semana: d }));
        const { error } = await supabase.from("treino_slots").insert(payloads);
        if (error) throw error;
        return payloads.length;
      }
    },
    onSuccess: (n) => {
      const msg = isEdit ? "Horário atualizado" : `${n} horário${n === 1 ? "" : "s"} criado${n === 1 ? "" : "s"}`;
      import("@/lib/toast-helpers").then(({ toastSuccess }) => toastSuccess(msg));
      onSaved();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar horário" : "Novo horário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{isEdit ? "Dia da semana" : "Dias da semana"}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {DIAS_CURTOS.map((d, i) => {
                const active = form.dias.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isEdit}
                    onClick={() => toggleDia(i)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted",
                      isEdit && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {!isEdit && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Selecione todos os dias com o mesmo horário e capacidade — será criado um horário para cada.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Capacidade máxima</Label>
            <Input type="number" min={1} value={form.capacidade_maxima}
              onChange={(e) => setForm({ ...form, capacidade_maxima: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Instrutor</Label>
            <Select value={form.instrutor_id || "none"} onValueChange={(v) => setForm({ ...form, instrutor_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem instrutor definido</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  confirmado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
  faltou: "bg-red-500/15 text-red-500 border-red-500/30",
  realizado: "bg-emerald-700/20 text-emerald-600 border-emerald-700/30",
};

const OCUPACAO_ATIVOS = new Set(["agendado", "confirmado", "realizado"]);

type AgendamentoRow = {
  id: string;
  slot_id: string;
  data: string;
  status: string;
  horario_inicio: string;
  aluno_id: string;
  alunos: { id: string; nome: string } | null;
};

type SelectedCell = {
  slot: Slot;
  data: Date;
} | null;

function SlotDetailSheet({
  selected,
  onClose,
  agendamentos,
  profileMap,
  isAdmin,
  onEdit,
  onRefetch,
}: {
  selected: SelectedCell;
  onClose: () => void;
  agendamentos: AgendamentoRow[];
  profileMap: Record<string, string>;
  isAdmin: boolean;
  onEdit: (s: Slot) => void;
  onRefetch: () => void;
}) {
  const dataStr = selected ? format(selected.data, "yyyy-MM-dd") : "";
  const listaBase = useMemo(
    () => (selected ? agendamentos.filter((a) => a.slot_id === selected.slot.id && a.data === dataStr) : []),
    [agendamentos, selected, dataStr],
  );
  const ativos = listaBase.filter((a) => OCUPACAO_ATIVOS.has(a.status));

  const updateStatus = useSupabaseMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("treino_agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    successMessage: "Status atualizado",
    onSuccess: () => onRefetch(),
  });

  const excluirComEstorno = useSupabaseMutation({
    mutationFn: async ({ id, estornar }: { id: string; estornar: boolean }) => {
      const { data, error } = await supabase.rpc("fn_staff_excluir_treino_agendamento", {
        p_agendamento_id: id,
        p_estornar: estornar,
      });
      if (error) throw error;
      const res = data as { ok: boolean; erro?: string; credito_estornado?: boolean };
      if (!res.ok) throw new Error(res.erro || "Falha ao excluir");
      return res;
    },
    onSuccess: (res) => {
      toastSuccess(res.credito_estornado ? "Agendamento excluído e crédito estornado" : "Agendamento excluído");
      onRefetch();
    },
    onError: (e: Error) => toastError(e.message),
  });

  if (!selected) return null;

  const ordered = [...listaBase].sort((a, b) => {
    const pa = OCUPACAO_ATIVOS.has(a.status) ? 0 : 1;
    const pb = OCUPACAO_ATIVOS.has(b.status) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.alunos?.nome ?? "").localeCompare(b.alunos?.nome ?? "");
  });

  return (
    <Sheet open={!!selected} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            {format(selected.data, "EEEE, d 'de' MMM", { locale: ptBR })}
          </SheetTitle>
          <div className="text-sm text-muted-foreground text-left flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              {selected.slot.horario_inicio.slice(0, 5)} – {selected.slot.horario_fim.slice(0, 5)}
            </span>
            {selected.slot.instrutor_id && (
              <>· <span>{profileMap[selected.slot.instrutor_id] ?? "—"}</span></>
            )}
            <Badge variant="outline" className="ml-auto">
              <Users className="w-3 h-3 mr-1" />
              {ativos.length}/{selected.slot.capacidade_maxima}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onEdit(selected.slot)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar horário
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno agendado neste horário.</p>
          ) : (
            ordered.map((a) => {
              const podeMarcar = ["agendado", "confirmado"].includes(a.status);
              return (
                <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.alunos?.nome ?? "—"}</div>
                    <Badge variant="outline" className={cn("border text-[10px] mt-0.5", STATUS_STYLES[a.status])}>
                      {a.status}
                    </Badge>
                  </div>
                  {podeMarcar && (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={() => updateStatus.mutate({ id: a.id, status: "realizado" })}>
                        Presente
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => updateStatus.mutate({ id: a.id, status: "faltou" })}>
                        Falta
                      </Button>
                    </>
                  )}
                  {isAdmin && a.status !== "cancelado" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação cancela o agendamento de <strong>{a.alunos?.nome}</strong> e estorna o crédito para o ciclo do aluno. Não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => excluirComEstorno.mutate({ id: a.id, estornar: true })}
                          >
                            Excluir com estorno
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WeeklyGrid({
  slots,
  profileMap,
  onEdit,
  isAdmin,
}: {
  slots: Slot[];
  profileMap: Record<string, string>;
  onEdit: (s: Slot) => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selected, setSelected] = useState<SelectedCell>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  // Uma linha por combinação única horario_inicio-horario_fim (apenas slots ativos + selecionados)
  const rows = useMemo(() => {
    const map = new Map<string, { horario_inicio: string; horario_fim: string }>();
    for (const s of slots) {
      const key = `${s.horario_inicio}-${s.horario_fim}`;
      if (!map.has(key)) map.set(key, { horario_inicio: s.horario_inicio, horario_fim: s.horario_fim });
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => toMinutes(a.horario_inicio) - toMinutes(b.horario_inicio));
  }, [slots]);

  // Índice: (dia_semana + horario_inicio + horario_fim) -> slot
  const slotIndex = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of slots) {
      m.set(`${s.dia_semana}|${s.horario_inicio}|${s.horario_fim}`, s);
    }
    return m;
  }, [slots]);

  const { data: agendamentos = [], refetch: refetchAg } = useQuery({
    queryKey: ["treino-agendamentos-semana", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("id, slot_id, data, status, horario_inicio, aluno_id, alunos:aluno_id(id, nome)")
        .gte("data", weekStartStr)
        .lte("data", weekEndStr);
      if (error) throw error;
      return (data ?? []) as AgendamentoRow[];
    },
  });

  // ocupação por (slot_id + data)
  const ocupacao = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agendamentos) {
      if (!OCUPACAO_ATIVOS.has(a.status)) continue;
      const k = `${a.slot_id}|${a.data}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [agendamentos]);

  const today = new Date();
  const rangeLabel = `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d MMM", { locale: ptBR })}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))} aria-label="Semana anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))} aria-label="Próxima semana">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
          Hoje
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={(d) => d && setWeekStart(startOfWeek(d, { weekStartsOn: 0 }))}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="p-3 overflow-x-auto">
        <div
          className="grid min-w-[820px]"
          style={{
            gridTemplateColumns: `72px repeat(7, minmax(96px, 1fr))`,
          }}
        >
          {/* Cabeçalho */}
          <div className="border-b border-border" />
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={`h-${i}`}
                className={cn(
                  "border-b border-border text-center py-1.5 text-xs",
                  isToday && "bg-primary/10",
                )}
              >
                <div className={cn("font-bold text-sm", isToday && "text-primary")}>{format(d, "d")}</div>
                <div className="uppercase text-[10px] text-muted-foreground tracking-wider">{DIAS_CURTOS[i]}</div>
              </div>
            );
          })}

          {/* Linhas */}
          {rows.length === 0 && (
            <div className="col-span-8 py-10 text-center text-sm text-muted-foreground">
              Nenhum horário cadastrado.
            </div>
          )}
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <div className="border-t border-border/60 text-[11px] text-muted-foreground py-2 pr-2 text-right leading-tight">
                <div className="font-medium text-foreground">{row.horario_inicio.slice(0, 5)}</div>
                <div>{row.horario_fim.slice(0, 5)}</div>
              </div>
              {weekDays.map((d, di) => {
                const dia = d.getDay();
                const slot = slotIndex.get(`${dia}|${row.horario_inicio}|${row.horario_fim}`);
                if (!slot) {
                  return (
                    <div key={`c-${row.key}-${di}`} className="border-t border-border/60 flex items-center justify-center text-muted-foreground/30">
                      ·
                    </div>
                  );
                }
                const dataStr = format(d, "yyyy-MM-dd");
                const ocup = ocupacao.get(`${slot.id}|${dataStr}`) ?? 0;
                const cheio = ocup >= slot.capacidade_maxima;
                const inativo = !slot.ativo;
                const agendadosDoSlot = agendamentos.filter(
                  (a) => a.slot_id === slot.id && a.data === dataStr && OCUPACAO_ATIVOS.has(a.status)
                );

                return (
                  <Tooltip key={`c-${row.key}-${di}`} delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelected({ slot, data: d })}
                        className={cn(
                          "border-t border-border/60 m-0.5 rounded-md px-2 py-1.5 text-left transition-colors border w-full h-full",
                          inativo && "opacity-40 bg-muted border-border",
                          !inativo && !cheio && "bg-primary/10 border-primary/30 hover:bg-primary/20",
                          !inativo && cheio && "bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25",
                        )}
                      >
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          <Users className="w-3 h-3" />
                          <span className={cn(cheio ? "text-amber-500" : "text-primary")}>
                            {ocup}/{slot.capacidade_maxima}
                          </span>
                        </div>
                        {slot.instrutor_id && (
                          <div className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                            {profileMap[slot.instrutor_id] ?? "—"}
                          </div>
                        )}
                        {inativo && <div className="text-[9px] uppercase text-muted-foreground">off</div>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="max-w-[220px] p-0">
                      <div className="px-3 py-2">
                        <div className="text-xs font-medium mb-1">
                          {slot.horario_inicio.slice(0, 5)} – {slot.horario_fim.slice(0, 5)} · {DIAS[dia]}
                        </div>
                        {agendadosDoSlot.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Nenhum aluno agendado.</div>
                        ) : (
                          <ul className="space-y-0.5">
                            {agendadosDoSlot.map((a) => (
                              <li key={a.id} className="text-xs flex items-center gap-1.5">
                                <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_STYLES[a.status]?.split(" ")[1]?.replace("text-", "bg-") || "bg-primary")} />
                                <span className="truncate">{a.alunos?.nome ?? "—"}</span>
                                <span className="text-[10px] text-muted-foreground capitalize">{a.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <SlotDetailSheet
        selected={selected}
        onClose={() => setSelected(null)}
        agendamentos={agendamentos}
        profileMap={profileMap}
        isAdmin={isAdmin}
        onEdit={(s) => { setSelected(null); onEdit(s); }}
        onRefetch={() => {
          refetchAg();
          qc.invalidateQueries({ queryKey: ["treino-agendamentos-dia"] });
        }}
      />
    </div>
  );
}

function HorariosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [view, setView] = useState<"grade" | "lista">("grade");
  const { data: roles } = useUserRoles();
  const isAdmin = !!roles?.isAdmin;

  const { data: slots = [], refetch } = useQuery({
    queryKey: ["treino-slots-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_slots")
        .select("*")
        .order("dia_semana")
        .order("horario_inicio");
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["treino-slots-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);

  const toggleAtivo = useSupabaseMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("treino_slots").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const grouped = useMemo(() => {
    const g: Record<number, Slot[]> = {};
    for (const s of slots) {
      (g[s.dia_semana] ??= []).push(s);
    }
    return g;
  }, [slots]);

  const openEdit = (s: Slot) => { setEditing(s); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Tabs value={view} onValueChange={(v) => setView(v as "grade" | "lista")}>
          <TabsList>
            <TabsTrigger value="grade">Grade semanal</TabsTrigger>
            <TabsTrigger value="lista">Lista por dia</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Horário
        </Button>
      </div>

      {slots.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum horário cadastrado. Clique em "Novo Horário" para começar.
        </Card>
      )}

      {slots.length > 0 && view === "grade" && (
        <WeeklyGrid slots={slots} profileMap={profileMap} onEdit={openEdit} isAdmin={isAdmin} />
      )}

      {slots.length > 0 && view === "lista" && DIAS.map((diaNome, diaIdx) => {
        const list = grouped[diaIdx] || [];
        if (!list.length) return null;
        return (
          <Card key={diaIdx} className="p-4">
            <h3 className="font-semibold mb-3">{diaNome}</h3>
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", !s.ativo && "opacity-60")}>
                  <div className="flex-1">
                    <div className="font-medium">
                      {s.horario_inicio.slice(0, 5)} → {s.horario_fim.slice(0, 5)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span><Users className="w-3 h-3 inline mr-1" />{s.capacidade_maxima} vagas</span>
                      {s.instrutor_id && <span>Instrutor: {profileMap[s.instrutor_id] ?? "—"}</span>}
                    </div>
                    {s.observacoes && <div className="text-xs text-muted-foreground mt-1">{s.observacoes}</div>}
                  </div>
                  <Switch checked={s.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: s.id, ativo: v })} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {dialogOpen && (
        <SlotDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          slot={editing}
          profiles={profiles}
          onSaved={refetch}
        />
      )}
    </div>
  );
}


function AgendamentosTab() {
  const [data, setData] = useState<Date>(new Date());

  const dataStr = format(data, "yyyy-MM-dd");
  const diaSemana = data.getDay();

  const { data: slots = [] } = useQuery({
    queryKey: ["treino-slots-dia", diaSemana],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_slots")
        .select("*")
        .eq("dia_semana", diaSemana)
        .eq("ativo", true)
        .order("horario_inicio");
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: agendamentos = [], refetch } = useQuery({
    queryKey: ["treino-agendamentos-dia", dataStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("id, slot_id, status, horario_inicio, aluno_id, alunos:aluno_id(id, nome)")
        .eq("data", dataStr)
        .order("horario_inicio");
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useSupabaseMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "cancelado") {
        patch.cancelado_em = new Date().toISOString();
        patch.cancelado_por = "staff";
      }
      const { error } = await supabase.from("treino_agendamentos").update(patch).eq("id", id);
      if (error) throw error;
    },
    successMessage: "Status atualizado",
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {format(data, "PPP", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={data} onSelect={(d) => d && setData(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {slots.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Nenhum horário ativo neste dia da semana.</Card>
      )}

      {slots.map((slot) => {
        const doSlot = agendamentos.filter((a) => a.slot_id === slot.id);
        const ativos = doSlot.filter((a) => ["agendado", "confirmado"].includes(a.status));
        return (
          <Card key={slot.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {slot.horario_inicio.slice(0, 5)} → {slot.horario_fim.slice(0, 5)}
              </h3>
              <Badge variant="outline">{ativos.length} / {slot.capacidade_maxima} alunos</Badge>
            </div>
            {doSlot.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem agendamentos.</p>
            ) : (
              <div className="space-y-2">
                {doSlot.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{a.alunos?.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.horario_inicio.slice(0, 5)}</div>
                    </div>
                    <Badge className={cn("border", STATUS_STYLES[a.status])} variant="outline">{a.status}</Badge>
                    {["agendado", "confirmado"].includes(a.status) && (
                      <>
                        <Button size="sm" variant="outline"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "realizado" })}>
                          Presente
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "faltou" })}>
                          Falta
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => updateStatus.mutate({ id: a.id, status: "cancelado" })}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function AgendaTreinos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agenda de Treinos</h1>
        <p className="text-sm text-muted-foreground">Configure horários semanais e acompanhe os agendamentos dos alunos.</p>
      </div>

      <Tabs defaultValue="horarios">
        <TabsList>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="horarios" className="mt-4"><HorariosTab /></TabsContent>
        <TabsContent value="agendamentos" className="mt-4"><AgendamentosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
