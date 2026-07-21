import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users, X, CheckCircle2, AlertCircle, Utensils, Footprints, Activity, ChevronDown, ChevronRight, Pin } from "lucide-react";
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
  const [abaAgenda, setAbaAgenda] = useState<"treinos" | "servicos" | "agendamentos">("treinos");
  const [servicoSelecionado, setServicoSelecionado] = useState<string | null>(null);
  const [showHistoricoTreinos, setShowHistoricoTreinos] = useState(false);
  const [filtroTreinos, setFiltroTreinos] = useState<"todos" | "realizado" | "faltou" | "cancelado">("todos");
  const [showHistoricoServicos, setShowHistoricoServicos] = useState(false);
  const [showAdicionarFixo, setShowAdicionarFixo] = useState(false);
  const [horarioFixoParaRemover, setHorarioFixoParaRemover] = useState<string | null>(null);
  const [diaFixo, setDiaFixo] = useState<number>(1);
  const [slotFixo, setSlotFixo] = useState<string>("");


  const iconServico = (atividade: string) => {
    const a = atividade.toLowerCase();
    if (a.includes("nutri")) return { icon: Utensils };
    if (a.includes("reab") || a.includes("fisio")) return { icon: Footprints };
    return { icon: Activity };
  };

  const dias7 = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(new Date(), i)), []);
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

  // Créditos de serviço (exceto Treino)
  const { data: servicosDisponiveis = [] } = useQuery({
    queryKey: ["portal-agenda-servicos-creditos", student?.id],
    enabled: !!student && abaAgenda === "servicos",
    queryFn: async () => {
      const { data } = await supabase
        .from("creditos_aluno" as any)
        .select("atividade, quantidade_inicial, quantidade_usada, ilimitado")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .neq("atividade", "Treino");
      return (data as any[]) || [];
    },
  });

  // Horários da agenda_servicos para o serviço selecionado
  const { data: horariosServico = [] } = useQuery({
    queryKey: ["portal-agenda-horarios-servico", servicoSelecionado],
    enabled: !!servicoSelecionado,
    queryFn: async () => {
      const { data } = await supabase
        .from("agenda_servicos")
        .select("id, atividade, horario_inicio, horario_fim, dia_semana, local, profissional_id, data_especifica")
        .eq("atividade", servicoSelecionado!)
        .order("dia_semana")
        .order("horario_inicio");
      return data || [];
    },
  });

  // Histórico de treinos (passados)
  const { data: historicoTreinos = [] } = useQuery({
    queryKey: ["portal-historico-treinos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("treino_agendamentos")
        .select("id, data, horario_inicio, horario_fim, status")
        .eq("aluno_id", student!.id)
        .lt("data", format(new Date(), "yyyy-MM-dd"))
        .in("status", ["realizado", "faltou", "cancelado"])
        .order("data", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  // Agendamentos futuros de serviços (agenda_servicos com confirmação)
  // Por enquanto, buscar de consumo_servicos para mostrar histórico real
  const { data: historicoServicos = [] } = useQuery({
    queryKey: ["portal-historico-servicos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("id, tipo_servico, data_consumo, quantidade")
        .eq("aluno_id", student!.id)
        .order("data_consumo", { ascending: false })
        .limit(30);
      return data || [];
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

      {/* Switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {[
          { key: "treinos", label: "🏋️ Treinos" },
          { key: "servicos", label: "📋 Serviços" },
          { key: "agendamentos", label: "📌 Meus" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAbaAgenda(tab.key as any)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
              abaAgenda === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {abaAgenda === "treinos" && (<>
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

                {jaAgendou ? (() => {
                  const agNesseSlot = meusAgendamentos.find(
                    (a: any) => a.data === dataStr && a.slot_id === slot.id
                  );
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-semibold">Agendado</span>
                      </div>
                      {agNesseSlot && (
                        <button
                          onClick={() => setCancelando(agNesseSlot.id)}
                          className="py-1.5 px-3 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  );
                })() : lotado ? (
                  <div className="text-sm text-muted-foreground font-semibold">Turma lotada</div>
                ) : jaTemNoDia ? (
                  <div className="w-full py-2.5 rounded-xl bg-muted/50 border border-border text-center text-xs font-semibold text-muted-foreground">
                    Você já tem um treino agendado neste dia
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
      </>)}

      {abaAgenda === "agendamentos" && (
        <div className="space-y-6">

          {/* ── SEÇÃO TREINOS ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🏋️</span>
              <SectionLabel>Treinos</SectionLabel>
            </div>

            {meusAgendamentos.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <p className="text-sm text-muted-foreground text-center">Nenhum treino agendado.</p>
                <button
                  onClick={() => setAbaAgenda("treinos")}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
                >
                  Agendar treino →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {meusAgendamentos.map((ag: any) => {
                  const deadline = new Date(`${ag.data}T${ag.horario_inicio}`);
                  deadline.setHours(deadline.getHours() - 1);
                  const dentroDoPrazo = new Date() < deadline;
                  return (
                    <div key={ag.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[44px] shrink-0">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">
                            {format(parseISO(ag.data + "T12:00:00"), "EEE", { locale: ptBR })}
                          </p>
                          <p className="text-2xl font-black text-foreground" style={{ fontFamily: 'Archivo,sans-serif' }}>
                            {format(parseISO(ag.data + "T12:00:00"), "d")}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground">
                            {ag.horario_inicio?.slice(0, 5)} → {ag.horario_fim?.slice(0, 5)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(ag.data + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                        </div>
                        <button
                          onClick={() => setCancelando(ag.id)}
                          className="py-1.5 px-3 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                      {!dentroDoPrazo && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 text-warning shrink-0" />
                          <p className="text-[10px] text-warning">Cancelamento fora do prazo não estorna crédito</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botão histórico de treinos */}
            <button
              onClick={() => setShowHistoricoTreinos(true)}
              className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
            >
              <span className="text-sm font-semibold text-foreground">Ver histórico de treinos</span>
              <div className="flex items-center gap-2">
                {historicoTreinos.length > 0 && (
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {historicoTreinos.length}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </section>

          {/* ── SEÇÃO SERVIÇOS ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <SectionLabel>Serviços</SectionLabel>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Agendamentos de serviços são feitos via WhatsApp com a equipe FORTEM.
              </p>
              <button
                onClick={() => setAbaAgenda("servicos")}
                className="w-full py-2.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground"
              >
                Ver serviços disponíveis →
              </button>
            </div>

            {/* Botão histórico de serviços */}
            <button
              onClick={() => setShowHistoricoServicos(true)}
              className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
            >
              <span className="text-sm font-semibold text-foreground">Ver histórico de serviços</span>
              <div className="flex items-center gap-2">
                {historicoServicos.length > 0 && (
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {historicoServicos.length}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </section>

        </div>
      )}


      {abaAgenda === "servicos" && (
        <div className="space-y-4">
          <SectionLabel>Seus créditos de serviço</SectionLabel>

          {servicosDisponiveis.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
              <p className="text-sm font-bold text-foreground">Nenhum serviço disponível</p>
              <p className="text-xs text-muted-foreground">
                Seus serviços inclusos no plano aparecerão aqui quando disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {servicosDisponiveis.map((s: any) => {
                const saldoS = s.ilimitado ? Infinity : s.quantidade_inicial - s.quantidade_usada;
                const temSaldo = saldoS > 0 || s.ilimitado;
                const { icon: Icon } = iconServico(s.atividade);
                const isSelected = servicoSelecionado === s.atividade;
                return (
                  <button
                    key={s.atividade}
                    onClick={() => setServicoSelecionado(isSelected ? null : s.atividade)}
                    disabled={!temSaldo}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                      isSelected
                        ? "bg-primary/10 border-primary/40"
                        : temSaldo
                          ? "bg-card border-border hover:border-primary/20"
                          : "bg-card border-border opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{s.atividade}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.ilimitado
                          ? "Ilimitado"
                          : `${saldoS} sessão${saldoS !== 1 ? "ões" : ""} disponível${saldoS !== 1 ? "is" : ""}`}
                      </p>
                    </div>
                    {isSelected && <ChevronDown className="w-4 h-4 text-primary shrink-0" />}
                    {!isSelected && temSaldo && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {servicoSelecionado && (
            <div className="space-y-3">
              <SectionLabel>Horários disponíveis — {servicoSelecionado}</SectionLabel>

              {horariosServico.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum horário disponível no momento.</p>
                  <p className="text-xs text-muted-foreground mt-1">Entre em contato com a equipe FORTEM.</p>
                </div>
              ) : (
                horariosServico.map((h: any) => (
                  <div key={h.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <div className="min-w-[44px] text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {h.data_especifica ? format(parseISO(h.data_especifica), "dd/MM") : DIA_ABREV[h.dia_semana]}
                      </p>
                      <p className="text-base font-black text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
                        {h.horario_inicio.slice(0, 5)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{h.atividade}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.horario_inicio.slice(0, 5)} → {h.horario_fim.slice(0, 5)}
                        {h.local ? ` · ${h.local}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const quando = h.data_especifica
                          ? format(parseISO(h.data_especifica), "dd/MM")
                          : DIA_ABREV[h.dia_semana];
                        window.open(
                          `https://wa.me/555135199451?text=${encodeURIComponent(
                            `Olá! Quero agendar ${h.atividade} no horário ${h.horario_inicio.slice(0, 5)} de ${quando}.`
                          )}`,
                          "_blank"
                        );
                      }}
                      className="py-2 px-3 rounded-lg bg-primary text-white text-xs font-bold"
                    >
                      Agendar
                    </button>
                  </div>
                ))
              )}

              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Prefere outro horário?</p>
                  <p className="text-xs text-muted-foreground">Fale com a equipe FORTEM pelo WhatsApp</p>
                </div>
                <button
                  onClick={() =>
                    window.open(
                      "https://wa.me/555135199451?text=" + encodeURIComponent("Olá! Quero agendar um serviço."),
                      "_blank"
                    )
                  }
                  className="py-2 px-3 rounded-lg bg-[#25D366] text-white text-xs font-bold"
                >
                  WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
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

      {/* ── HISTÓRICO DE TREINOS ── */}
      {showHistoricoTreinos && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowHistoricoTreinos(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div>
                <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>🏋️ Histórico de Treinos</p>
                {(() => {
                  const mesAtual = format(new Date(), "yyyy-MM");
                  const realizadosMes = historicoTreinos.filter((h: any) =>
                    h.data.startsWith(mesAtual) && h.status === "realizado"
                  ).length;
                  return realizadosMes > 0 ? (
                    <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                      {realizadosMes} treino{realizadosMes > 1 ? "s" : ""} realizado{realizadosMes > 1 ? "s" : ""} em {format(new Date(), "MMMM", {locale: ptBR})}
                    </p>
                  ) : null;
                })()}
              </div>
              <button onClick={() => setShowHistoricoTreinos(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 px-5 py-3 overflow-x-auto shrink-0">
              {[
                { key: "todos", label: "Todos" },
                { key: "realizado", label: "✅ Realizados" },
                { key: "faltou", label: "❌ Faltas" },
                { key: "cancelado", label: "🚫 Cancelados" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroTreinos(f.key as any)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    filtroTreinos === f.key
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-2">
              {historicoTreinos
                .filter((h: any) => filtroTreinos === "todos" || h.status === filtroTreinos)
                .map((h: any) => (
                  <div key={h.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    <div className="text-center min-w-[44px] shrink-0">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {format(parseISO(h.data + "T12:00:00"), "EEE", {locale: ptBR})}
                      </p>
                      <p className="text-lg font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                        {format(parseISO(h.data + "T12:00:00"), "d")}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {format(parseISO(h.data + "T12:00:00"), "MMM", {locale: ptBR})}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {h.horario_inicio?.slice(0, 5)} → {h.horario_fim?.slice(0, 5)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      h.status === "realizado"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : h.status === "faltou"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {h.status === "realizado" ? "✅ Realizado" : h.status === "faltou" ? "❌ Falta" : "🚫 Cancelado"}
                    </span>
                  </div>
                ))}
              {historicoTreinos.filter((h: any) => filtroTreinos === "todos" || h.status === filtroTreinos).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum treino encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTÓRICO DE SERVIÇOS ── */}
      {showHistoricoServicos && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowHistoricoServicos(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>📋 Histórico de Serviços</p>
              <button onClick={() => setShowHistoricoServicos(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-2 pt-3">
              {historicoServicos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço registrado.</p>
              ) : historicoServicos.map((s: any) => {
                const { icon: Icon } = iconServico(s.tipo_servico ?? "");
                return (
                  <div key={s.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{s.tipo_servico}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.data_consumo ? format(parseISO(s.data_consumo), "dd 'de' MMMM 'de' yyyy", {locale: ptBR}) : "—"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      ✅ Realizado
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
