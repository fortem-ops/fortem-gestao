import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Users, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

type Slot = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  capacidade_maxima: number;
  instrutor_id: string | null;
};

type Agendamento = {
  id: string;
  data: string;
  slot_id: string;
  horario_inicio: string;
  horario_fim: string;
  status: string;
  treino_slots: Slot | null;
};

const DIA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

export default function PortalAgenda() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date());
  const [confirmando, setConfirmando] = useState<{ slot: Slot; data: string; instrutor?: string } | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const dias7 = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);
  const dataStr = format(diaSelecionado, "yyyy-MM-dd");

  const { data: cicloAtivo } = useQuery({
    queryKey: ["portal-home-ciclo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("ciclos_credito")
        .select("creditos_liberados, creditos_usados, data_fim, status")
        .eq("status", "ativo")
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const saldo = cicloAtivo ? Math.max(0, cicloAtivo.creditos_liberados - cicloAtivo.creditos_usados) : 0;

  const { data: slots = [] } = useQuery({
    queryKey: ["portal-treino-slots", diaSelecionado.getDay()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_slots")
        .select("*")
        .eq("dia_semana", diaSelecionado.getDay())
        .eq("ativo", true)
        .order("horario_inicio");
      if (error) throw error;
      return (data || []) as Slot[];
    },
  });

  // Instrutores (nomes)
  const instrutorIds = useMemo(() => [...new Set(slots.map((s) => s.instrutor_id).filter(Boolean))] as string[], [slots]);
  const { data: instrutores = {} } = useQuery({
    queryKey: ["portal-instrutores", instrutorIds.sort().join(",")],
    enabled: instrutorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", instrutorIds);
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.user_id] = p.full_name;
      return map;
    },
  });

  // Vagas ocupadas no dia
  const { data: agendamentosDia = [] } = useQuery({
    queryKey: ["portal-vagas-dia", dataStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("slot_id, aluno_id, status")
        .eq("data", dataStr)
        .in("status", ["agendado", "confirmado"]);
      if (error) throw error;
      return data || [];
    },
  });

  // Meus agendamentos futuros
  const { data: meusAgendamentos = [] } = useQuery({
    queryKey: ["portal-meus-agendamentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("*, treino_slots(*)")
        .eq("aluno_id", student!.id)
        .gte("data", format(new Date(), "yyyy-MM-dd"))
        .in("status", ["agendado", "confirmado"])
        .order("data", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data || []) as Agendamento[];
    },
  });

  // Dias que têm slots ativos (bolinha vermelha)
  const { data: diasComSlots = new Set<number>() } = useQuery({
    queryKey: ["portal-dias-com-slots"],
    queryFn: async () => {
      const { data } = await supabase.from("treino_slots").select("dia_semana").eq("ativo", true);
      return new Set((data || []).map((s) => s.dia_semana));
    },
  });

  const agendar = useMutation({
    mutationFn: async ({ slotId, data }: { slotId: string; data: string }) => {
      const { data: result, error } = await supabase.rpc("fn_agendar_treino", {
        p_slot_id: slotId,
        p_data: data,
      });
      if (error) throw error;
      const r = result as any;
      if (!r.ok) throw new Error(r.erro);
      return r;
    },
    onSuccess: (result: any) => {
      toast.success("Treino agendado!", {
        description: `${result.creditos_restantes} crédito(s) restante(s).`,
      });
      setConfirmando(null);
      qc.invalidateQueries({ queryKey: ["portal-vagas-dia"] });
      qc.invalidateQueries({ queryKey: ["portal-meus-agendamentos"] });
      qc.invalidateQueries({ queryKey: ["portal-home-ciclo"] });
      qc.invalidateQueries({ queryKey: ["portal-home-plano"] });
    },
    onError: (e: any) => {
      const msgs: Record<string, string> = {
        sem_creditos: "Você não tem créditos disponíveis.",
        sem_vagas: "Não há vagas disponíveis neste horário.",
        ja_agendado_neste_dia: "Você já tem um treino agendado neste dia.",
        data_passada: "Não é possível agendar para datas passadas.",
        dia_invalido: "Dia inválido para este horário.",
      };
      toast.error(msgs[e.message] || "Erro ao agendar. Tente novamente.");
      setConfirmando(null);
    },
  });

  const cancelar = useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { data: result, error } = await supabase.rpc("fn_cancelar_treino_agendamento", {
        p_agendamento_id: agendamentoId,
      });
      if (error) throw error;
      const r = result as any;
      if (!r.ok) throw new Error(r.erro);
      return r;
    },
    onSuccess: (result: any) => {
      toast.success("Agendamento cancelado", { description: result.mensagem });
      setCancelando(null);
      qc.invalidateQueries({ queryKey: ["portal-meus-agendamentos"] });
      qc.invalidateQueries({ queryKey: ["portal-vagas-dia"] });
      if (result.credito_estornado) {
        qc.invalidateQueries({ queryKey: ["portal-home-ciclo"] });
      }
    },
    onError: () => toast.error("Erro ao cancelar."),
  });

  return (
    <div className="space-y-6 pb-32 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-black tracking-tight text-foreground"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            Agendar Treino
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Escolha o melhor horário na semana</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Créditos</p>
          <p className="text-xl font-black text-primary" style={{ fontFamily: "Archivo, sans-serif" }}>{saldo}</p>
        </div>
      </div>

      {/* Calendário semanal horizontal */}
      <section className="space-y-2">
        <SectionLabel>Próximos 7 dias</SectionLabel>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {dias7.map((d) => {
            const ativo = isSameDay(d, diaSelecionado);
            const temSlots = diasComSlots.has(d.getDay());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDiaSelecionado(d)}
                className={cn(
                  "min-w-[62px] snap-start rounded-2xl border py-3 px-2 text-center transition-all relative",
                  ativo
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-foreground hover:border-primary/40"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{DIA_ABREV[d.getDay()]}</div>
                <div className="text-xl font-black mt-0.5" style={{ fontFamily: "Archivo, sans-serif" }}>
                  {d.getDate()}
                </div>
                {temSlots && !ativo && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Slots do dia */}
      <section className="space-y-3">
        <SectionLabel>{format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}</SectionLabel>
        {slots.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Sem horários disponíveis neste dia.</p>
          </div>
        ) : (
          slots.map((slot) => {
            const ocupadas = agendamentosDia.filter((a) => a.slot_id === slot.id).length;
            const jaAgendou = agendamentosDia.some((a) => a.slot_id === slot.id && a.aluno_id === student?.id);
            const jaTemNoDia = meusAgendamentos.some((a) => a.data === dataStr);
            const lotado = ocupadas >= slot.capacidade_maxima;
            const pct = Math.min(100, (ocupadas / slot.capacidade_maxima) * 100);
            const instrutorNome = slot.instrutor_id ? instrutores[slot.instrutor_id] : null;
            const semCreditos = saldo <= 0;

            return (
              <div key={slot.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-lg font-black text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
                      {slot.horario_inicio.slice(0, 5)} → {slot.horario_fim.slice(0, 5)}
                    </div>
                    {instrutorNome && (
                      <div className="text-xs text-muted-foreground mt-0.5">Instrutor: {instrutorNome}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {ocupadas} / {slot.capacidade_maxima}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vagas</div>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", lotado ? "bg-red-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {jaAgendou ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-500 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Agendado
                  </div>
                ) : lotado ? (
                  <div className="text-sm text-muted-foreground font-semibold">Turma lotada</div>
                ) : jaTemNoDia ? (
                  <div className="w-full py-2.5 rounded-xl bg-muted/50 border border-border text-center text-xs font-semibold text-muted-foreground">
                    Você já tem um treino agendado hoje
                  </div>
                ) : semCreditos ? (
                  <Button className="w-full" disabled>
                    Sem créditos
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() =>
                      setConfirmando({
                        slot,
                        data: dataStr,
                        instrutor: instrutorNome ?? undefined,
                      })
                    }
                  >
                    Agendar →
                  </Button>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Meus próximos treinos */}
      {meusAgendamentos.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Meus próximos treinos</SectionLabel>
          {meusAgendamentos.map((ag) => (
            <div key={ag.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              {/* Data */}
              <div className="text-center min-w-[40px]">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{format(parseISO(ag.data), 'EEE', {locale: ptBR})}</p>
                <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{format(parseISO(ag.data), 'd')}</p>
              </div>
              {/* Info */}
              <div className="flex-1">
                <p className="font-bold text-sm text-foreground">{ag.horario_inicio.slice(0,5)} → {ag.horario_fim.slice(0,5)}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(ag.data), "dd 'de' MMMM", {locale: ptBR})}</p>
              </div>
              {/* Botão cancelar */}
              <button onClick={() => setCancelando(ag.id)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Dialog confirmar */}
      <Dialog open={!!confirmando} onOpenChange={(v) => !v && setConfirmando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar agendamento</DialogTitle>
            <DialogDescription>Verifique os detalhes abaixo antes de confirmar.</DialogDescription>
          </DialogHeader>
          {confirmando && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">
                {format(parseISO(confirmando.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-foreground">
                {confirmando.slot.horario_inicio.slice(0, 5)} → {confirmando.slot.horario_fim.slice(0, 5)}
              </p>
              {confirmando.instrutor && <p className="text-muted-foreground">Instrutor: {confirmando.instrutor}</p>}
              <div className="bg-muted/50 rounded-lg p-3 mt-2">
                <p className="text-xs text-muted-foreground">1 crédito será debitado.</p>
                <p className="text-xs text-muted-foreground">Você terá {Math.max(0, saldo - 1)} crédito(s) restante(s).</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmando && agendar.mutate({ slotId: confirmando.slot.id, data: confirmando.data })}
              disabled={agendar.isPending}
            >
              Confirmar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog cancelar */}
      {cancelando && (() => {
        const ag = meusAgendamentos.find(a => a.id === cancelando);
        if (!ag) return null;
        const deadline = new Date(`${ag.data}T${ag.horario_inicio}`);
        deadline.setHours(deadline.getHours() - 1);
        const dentroDoprazo = new Date() < deadline;
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
            <div className="bg-card border border-border rounded-t-2xl w-full p-6 space-y-4">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Cancelar treino?</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(ag.data), "EEEE, dd 'de' MMMM", {locale: ptBR})} às {ag.horario_inicio.slice(0,5)}
              </p>
              {!dentroDoprazo && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    O prazo de 1h já passou. O crédito <strong>não será estornado</strong>.
                  </p>
                </div>
              )}
              {dentroDoprazo && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-xs text-emerald-400">✓ Crédito será estornado automaticamente.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setCancelando(null)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">Voltar</button>
                <button
                  onClick={() => cancelar.mutate(cancelando)}
                  disabled={cancelar.isPending}
                  className="flex-1 py-3 rounded-xl bg-destructive text-white font-bold text-sm"
                >
                  {cancelar.isPending ? 'Cancelando...' : 'Cancelar treino'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
