import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users, X, CheckCircle2, AlertCircle, Utensils, Footprints, Activity, ChevronDown, ChevronRight, Pin, CalendarPlus, Copy, Check } from "lucide-react";
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
  const [calCopied, setCalCopied] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [horarioFixoAberto, setHorarioFixoAberto] = useState(false);



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

  // Feed ICS pessoal (webcal)
  const { data: calendarToken } = useQuery({
    queryKey: ["portal-calendar-token", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data: existing } = await (supabase as any)
        .from("aluno_calendar_tokens")
        .select("token")
        .eq("aluno_id", student!.id)
        .maybeSingle();
      if (existing?.token) return existing.token as string;
      const newToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const { data, error } = await (supabase as any)
        .from("aluno_calendar_tokens")
        .insert({ aluno_id: student!.id, token: newToken })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
  });

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const feedHttpsUrl = supabaseUrl && calendarToken
    ? `${supabaseUrl}/functions/v1/agenda-ics?token=${calendarToken}`
    : "";
  const feedWebcalUrl = feedHttpsUrl.replace(/^https?:\/\//, "webcal://");

  const copyFeed = async () => {
    if (!feedHttpsUrl) return;
    try {
      await navigator.clipboard.writeText(feedHttpsUrl);
      setCalCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCalCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // Dias que têm slots ativos (bolinha vermelha)
  const { data: diasComSlots = new Set<number>() } = useQuery({
    queryKey: ["portal-dias-com-slots"],
    queryFn: async () => {
      const { data } = await supabase.from("treino_slots").select("dia_semana").eq("ativo", true);
      return new Set((data || []).map((s) => s.dia_semana));
    },
  });

  // Horários fixos do aluno
  const { data: horariosFixos = [] } = useQuery({
    queryKey: ["portal-horarios-fixos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_horarios_fixos")
        .select("*, treino_slots(horario_inicio, horario_fim)")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("dia_semana");
      return data || [];
    },
  });

  // Plano ativo (elegibilidade horário fixo)
  const { data: planoPortal } = useQuery({
    queryKey: ["portal-plano-horario-fixo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("tipo")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { tipo: data.tipo, frequencia_semanal: student?.frequencia_semanal ?? 1 } : null;
    },
  });

  // Slots disponíveis para o dia escolhido no bottom sheet de horário fixo
  const { data: slotsFixo = [] } = useQuery({
    queryKey: ["portal-slots-fixo-dia", diaFixo],
    enabled: showAdicionarFixo,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_slots")
        .select("*")
        .eq("dia_semana", diaFixo)
        .eq("ativo", true)
        .order("horario_inicio");
      return data || [];
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
        .lte("data", format(new Date(), "yyyy-MM-dd"))
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
        horario_passado: "Esse horário já passou. Escolha outro horário disponível.",
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
            const ehHoje = isSameDay(diaSelecionado, new Date());
            const slotPassou = ehHoje && (() => {
              const [hh, mm] = slot.horario_inicio.split(":").map(Number);
              const inicio = new Date();
              inicio.setHours(hh, mm, 0, 0);
              return inicio.getTime() <= Date.now();
            })();

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
                ) : slotPassou ? (
                  <div className="w-full py-2.5 rounded-xl bg-muted/50 border border-border text-center text-xs font-semibold text-muted-foreground">
                    Horário encerrado
                  </div>
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

          {/* ── SINCRONIZAR CALENDÁRIO ── */}
          <section className="space-y-2">
            <SectionLabel>Sincronizar com meu calendário</SectionLabel>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                  <CalendarPlus className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Assine sua agenda Fortem</p>
                  <p className="text-xs text-muted-foreground">Seus treinos e serviços aparecem automaticamente no seu calendário.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#0F0F0F] border border-border rounded-lg px-3 py-2">
                <p className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
                  {feedHttpsUrl || "Gerando link…"}
                </p>
                <button
                  onClick={copyFeed}
                  disabled={!feedHttpsUrl}
                  className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 disabled:opacity-40"
                  aria-label="Copiar link"
                >
                  {calCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                </button>
              </div>

              {feedWebcalUrl && (
                <a
                  href={feedWebcalUrl}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 text-xs font-bold text-primary"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Abrir no Calendário do iPhone
                </a>
              )}

              <div className="space-y-2 pt-1">
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-0.5">Google Calendar</p>
                  <p>Abra <span className="font-mono text-foreground">calendar.google.com</span> no computador → <span className="text-foreground">Outras agendas (+)</span> → <span className="text-foreground">Por URL</span> → cole o link.</p>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-0.5">iPhone</p>
                  <p>Toque em <span className="text-foreground">Abrir no Calendário do iPhone</span>, ou copie o link e cole em <span className="text-foreground">Ajustes → Calendário → Contas → Adicionar Conta → Outra → Calendário por Assinatura</span>.</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">O link é pessoal — não compartilhe. A atualização no calendário pode levar algumas horas.</p>
            </div>
          </section>


          {/* ── SEÇÃO HORÁRIO FIXO ── */}
          {(() => {
            const planoTipo = planoPortal?.tipo ?? "";
            const freq = planoPortal?.frequencia_semanal ?? 1;
            const elegivel = ["Power", "Pro", "Max"].includes(planoTipo);
            const DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
            return (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <SectionLabel>Horário Fixo</SectionLabel>
                  {elegivel && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                      {horariosFixos.length}/{freq} slots
                    </span>
                  )}
                </div>

                {!elegivel ? (
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔒</span>
                      <p className="text-sm font-bold text-foreground">Exclusivo Power, Pro e Max</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Garanta seu horário toda semana automaticamente, sem precisar agendar manualmente.
                    </p>
                    <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                      <p>A partir do plano <strong className="text-foreground">Power</strong>, você pode fixar horários conforme sua frequência semanal contratada.</p>
                      <p>Exemplo: se você treina <strong className="text-foreground">3×/semana</strong>, pode fixar até <strong className="text-foreground">3 horários</strong> automaticamente.</p>
                    </div>
                    <button
                      onClick={() => window.open('https://wa.me/555135199451?text=Olá! Quero fazer upgrade do meu plano para ter horário fixo.', '_blank')}
                      className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
                    >
                      🚀 Fazer upgrade e garantir meu horário →
                    </button>
                  </div>
                ) : horariosFixos.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhum horário fixo configurado ainda.
                    </p>
                    <button
                      onClick={() => setShowAdicionarFixo(true)}
                      className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Pin className="w-3.5 h-3.5" /> Configurar horário fixo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {horariosFixos.map((hf: any) => {
                      const pausado = hf.pausado_ate && new Date(hf.pausado_ate) >= new Date();
                      return (
                        <div key={hf.id} className={`bg-card border rounded-xl p-4 flex items-center gap-3 ${pausado ? "border-border opacity-60" : "border-primary/30"}`}>
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Pin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">
                              {DIAS_LABEL[hf.dia_semana]} · {hf.horario_inicio?.slice(0, 5)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pausado ? `Pausado até ${format(parseISO(hf.pausado_ate + "T12:00:00"), "dd/MM/yyyy")}` : "Reserva automática toda semana ✓"}
                            </p>
                          </div>
                          <button
                            onClick={() => setHorarioFixoParaRemover(hf.id)}
                            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                    {horariosFixos.length < freq && (
                      <button
                        onClick={() => setShowAdicionarFixo(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-primary/30 text-xs font-semibold text-primary flex items-center justify-center gap-2"
                      >
                        <Pin className="w-3.5 h-3.5" /> Adicionar horário fixo
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })()}


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

      {/* Bottom sheet: Adicionar horário fixo */}
      {showAdicionarFixo && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowAdicionarFixo(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />
            <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>📌 Novo Horário Fixo</p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Dia da semana</p>
                <div className="flex gap-2 flex-wrap">
                  {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => { setDiaFixo(i); setSlotFixo(""); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${diaFixo === i ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Horário</p>
                {slotsFixo.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum slot disponível neste dia.</p>
                ) : (
                  <div className="space-y-2">
                    {slotsFixo.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => setSlotFixo(s.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${slotFixo === s.id ? "bg-primary/10 border-primary/40" : "bg-background border-border"}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${slotFixo === s.id ? "border-primary" : "border-muted-foreground"}`}>
                          {slotFixo === s.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{s.horario_inicio.slice(0,5)} → {s.horario_fim.slice(0,5)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowAdicionarFixo(false); setSlotFixo(""); }} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">Cancelar</button>
              <button
                disabled={!slotFixo}
                onClick={async () => {
                  if (!slotFixo || !student) return;
                  const slot = slotsFixo.find((s: any) => s.id === slotFixo);
                  if (!slot) return;
                  try {
                    const { error } = await (supabase as any).from("treino_horarios_fixos").insert({
                      aluno_id: student.id,
                      slot_id: slotFixo,
                      dia_semana: diaFixo,
                      horario_inicio: slot.horario_inicio,
                      horario_fim: slot.horario_fim,
                      criado_por: "aluno",
                    });
                    if (error) throw error;
                    await supabase.rpc("fn_processar_horarios_fixos");
                    toast.success("Horário fixo configurado! Agendamentos criados para as próximas semanas.");
                    qc.invalidateQueries({ queryKey: ["portal-horarios-fixos"] });
                    qc.invalidateQueries({ queryKey: ["portal-meus-agendamentos"] });
                    setShowAdicionarFixo(false);
                    setSlotFixo("");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Remover horário fixo */}
      {horarioFixoParaRemover && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setHorarioFixoParaRemover(null)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />
            <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Remover horário fixo?</p>
            <p className="text-sm text-muted-foreground">Este horário não será mais reservado automaticamente nas próximas semanas. Agendamentos já criados permanecem.</p>
            <div className="flex gap-3">
              <button onClick={() => setHorarioFixoParaRemover(null)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">Cancelar</button>
              <button
                onClick={async () => {
                  await (supabase as any).from("treino_horarios_fixos").update({ ativo: false }).eq("id", horarioFixoParaRemover);
                  toast.success("Horário fixo removido.");
                  qc.invalidateQueries({ queryKey: ["portal-horarios-fixos"] });
                  setHorarioFixoParaRemover(null);
                }}
                className="flex-1 py-3 rounded-xl bg-destructive text-white font-bold text-sm"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
