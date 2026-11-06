import { horarioFuturoPortal } from "@/components/portal/portalPresentation";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users, X, CheckCircle2, AlertCircle, Utensils, Footprints, Activity, ChevronDown, ChevronRight, Pin, CalendarPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saldoTotalPorAtividade } from "@/lib/creditosServicos";
import { supabase } from "@/integrations/supabase/client";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
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
  modalidade?: string | null;
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

// Serviços sempre exibidos na aba "Serviços" do portal.
// `atividade` precisa ser idêntico a agenda_servicos.atividade (é o filtro da grade e
// o nome que fn_agendar_servico usa); `label` é só o nome de exibição.
const SERVICOS_PORTAL: { label: string; atividade: string }[] = [
  { label: "Nutrição", atividade: "Nutrição" },
  { label: "Reabilitação", atividade: "Reabilitação" },
  { label: "Avaliação Funcional", atividade: "Avaliação Funcional" },
  { label: "Bota de Compressão Pneumática (Recovery)", atividade: "Recovery (Bota de Compressão)" },
];

const RECOVERY = "Recovery (Bota de Compressão)";

const PERIODOS = [
  { key: "manha", label: "Manhã", de: 0, ate: 11 * 60 + 59 },
  { key: "tarde", label: "Tarde", de: 12 * 60, ate: 17 * 60 + 59 },
  { key: "noite", label: "Noite", de: 18 * 60, ate: 24 * 60 },
] as const;

function minutosDe(h: string): number {
  const [hh, mm] = h.slice(0, 5).split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">
      {children}
    </p>
  );
}

export default function PortalAgenda() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [agoraVisual, setAgoraVisual] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgoraVisual(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date());
  const [confirmando, setConfirmando] = useState<{ slot: Slot; data: string; instrutor?: string } | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [cancelandoServico, setCancelandoServico] = useState<string | null>(null);
  const [abaAgenda, setAbaAgenda] = useState<"treinos" | "servicos">("treinos");
  const [modalidadeTreino, setModalidadeTreino] = useState<"funcional" | "corrida">("funcional");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [meusAgendamentosAberto, setMeusAgendamentosAberto] = useState(false);
  const [servicoSelecionado, setServicoSelecionado] = useState<string | null>(null);
  const [diaServico, setDiaServico] = useState<Date | null>(null);
  const [confirmandoServico, setConfirmandoServico] = useState<{ h: any; data: string; label: string } | null>(null);
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

  const slotsTreino = useMemo(() => slots.filter((s) => (s.modalidade ?? "treino") !== "corrida"), [slots]);
  const slotsCorrida = useMemo(() => slots.filter((s) => s.modalidade === "corrida"), [slots]);

  // Contrato de Corrida ativo (libera agendamento sem crédito)
  const { data: temPlanoCorrida = false } = useQuery({
    queryKey: ["portal-contrato-corrida", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("contratos")
        .select("id, data_fim")
        .eq("aluno_id", student!.id)
        .eq("status", "ativo")
        .eq("plano_tipo", "corrida");
      return (data || []).some((c: any) => !c.data_fim || c.data_fim >= hoje);
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

  // Vagas ocupadas no dia (só cancelado libera a vaga)
  const { data: agendamentosDia = [] } = useQuery({
    queryKey: ["portal-vagas-dia", dataStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("id, slot_id, aluno_id, status")
        .eq("data", dataStr)
        .in("status", ["agendado", "confirmado", "realizado", "faltou"]);
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

  // Gera token aleatório sem depender de crypto.randomUUID (indisponível em
  // navegadores móveis antigos / contextos não seguros).
  const gerarTokenCalendario = () => {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  // Feed ICS pessoal (webcal)

  const {
    data: calendarToken,
    isError: calendarTokenError,
    isFetching: calendarTokenFetching,
    refetch: refetchCalendarToken,
    error: calendarTokenErrorObj,
  } = useQuery({
    queryKey: ["portal-calendar-token", student?.id],
    enabled: !!student,
    retry: 1,
    queryFn: async () => {
      const fetchExisting = async () => {
        const { data, error } = await (supabase as any)
          .from("aluno_calendar_tokens")
          .select("token")
          .eq("aluno_id", student!.id)
          .maybeSingle();
        if (error) throw error;
        return (data?.token as string | undefined) ?? null;
      };

      const existing = await fetchExisting();
      if (existing) return existing;

      const newToken = gerarTokenCalendario();
      const { data, error } = await (supabase as any)
        .from("aluno_calendar_tokens")
        .insert({ aluno_id: student!.id, token: newToken })
        .select("token")
        .maybeSingle();

      if (error) {
        // Conflito (outra aba/dispositivo criou o token antes) → relê
        const retry = await fetchExisting();
        if (retry) return retry;
        throw error;
      }
      if (data?.token) return data.token as string;

      const after = await fetchExisting();
      if (after) return after;
      throw new Error("Não foi possível gerar o link do calendário.");
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

  // Dias que têm slots ativos (bolinha vermelha) — por modalidade
  const { data: diasPorModalidade } = useQuery({
    queryKey: ["portal-dias-com-slots"],
    queryFn: async () => {
      const { data } = await supabase.from("treino_slots").select("dia_semana, modalidade").eq("ativo", true);
      const treino = new Set<number>();
      const corrida = new Set<number>();
      for (const s of (data || []) as any[]) {
        (s.modalidade === "corrida" ? corrida : treino).add(s.dia_semana);
      }
      return { treino, corrida };
    },
  });
  const diasComSlotsTreino = diasPorModalidade?.treino ?? new Set<number>();
  const diasComSlotsCorrida = diasPorModalidade?.corrida ?? new Set<number>();

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

  // Plano ativo (elegibilidade horário fixo) — usa apenas o plano principal de Treinamento Funcional, ignorando Corrida
  const { data: planoPortal } = useQuery({
    queryKey: ["portal-plano-horario-fixo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await queryPlanoPrincipalAtivo(student!.id, "tipo");
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

  // Créditos de serviço do aluno (plano + avulso), mesma lógica da Home
  const { data: creditosServicos = [] } = useQuery({
    queryKey: ["portal-agenda-servicos-creditos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("creditos_aluno" as any)
        .select("atividade, quantidade_inicial, quantidade_usada, ilimitado, data_validade")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .neq("atividade", "Treino");
      return ((data as any[]) || []).filter(
        (c) => !c.data_validade || c.data_validade >= hoje
      );
    },
  });

  // Plano ativo (para serviços inclusos) — mesma fonte da Home
  const { data: planoAtivoServicos } = useQuery({
    queryKey: ["portal-agenda-plano-servicos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await queryPlanoPrincipalAtivo(student!.id, "id, servicos");
      return data as any;
    },
  });

  const { data: consumosPlano = [] } = useQuery({
    queryKey: ["portal-agenda-consumos", student?.id, planoAtivoServicos?.id],
    enabled: !!student && !!planoAtivoServicos?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("tipo_servico, tipo_registro, quantidade, agenda_id")
        .eq("aluno_id", student!.id)
        .eq("plano_id", planoAtivoServicos!.id);
      return (data as any[]) || [];
    },
  });

  // Saldo consolidado por atividade (plano + avulso)
  const saldoPorAtividade = useMemo(
    () =>
      saldoTotalPorAtividade(
        (planoAtivoServicos as any)?.servicos,
        consumosPlano as any[],
        creditosServicos as any[],
      ),
    [planoAtivoServicos, consumosPlano, creditosServicos],
  );


  // Horários "modelo" abertos (sem aluno) do serviço selecionado
  const { data: horariosServico = [] } = useQuery({
    queryKey: ["portal-agenda-horarios-servico", servicoSelecionado],
    enabled: !!servicoSelecionado,
    queryFn: async () => {
      const { data } = await supabase
        .from("agenda_servicos")
        .select("id, atividade, horario_inicio, horario_fim, dia_semana, local, profissional_id, data_especifica, tipo")
        .eq("atividade", servicoSelecionado!)
        .eq("visivel_portal", true)
        .is("aluno_id", null)
        .order("dia_semana")
        .order("horario_inicio");
      return data || [];
    },
  });

  // Materializa os horários recorrentes em datas concretas (próximos 14 dias)
  const dias14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);

  const janela14 = useMemo(
    () => ({
      inicio: format(dias14[0], "yyyy-MM-dd"),
      fim: format(dias14[dias14.length - 1], "yyyy-MM-dd"),
    }),
    [dias14],
  );

  const profissionaisHorarios = useMemo(
    () => Array.from(new Set((horariosServico as any[]).map((h) => h.profissional_id).filter(Boolean))),
    [horariosServico],
  );

  // Reservas já feitas (com aluno vinculado) para esses profissionais na janela de 14 dias
  const { data: reservasServico = [] } = useQuery({
    queryKey: ["portal-agenda-reservas-servico", profissionaisHorarios, janela14.inicio, janela14.fim],
    enabled: profissionaisHorarios.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("agenda_servicos")
        .select("profissional_id, data_especifica, horario_inicio")
        .not("aluno_id", "is", null)
        .in("profissional_id", profissionaisHorarios as string[])
        .gte("data_especifica", janela14.inicio)
        .lte("data_especifica", janela14.fim);
      return data || [];
    },
  });

  const ocupadosSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of reservasServico as any[]) {
      if (!r.data_especifica) continue;
      s.add(`${r.profissional_id ?? ""}|${r.data_especifica}|${String(r.horario_inicio).slice(0, 5)}`);
    }
    return s;
  }, [reservasServico]);

  // Agendamentos futuros de serviços
  const { data: servicosFuturos = [] } = useQuery({
    queryKey: ["portal-servicos-futuros", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("agenda_servicos")
        .select("id, atividade, local, data_especifica, horario_inicio, horario_fim")
        .eq("aluno_id", student!.id)
        .gte("data_especifica", format(new Date(), "yyyy-MM-dd"))
        .order("data_especifica", { ascending: true });
      return (data || []) as any[];
    },
  });

  const horariosServicoPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of dias14) {
      const key = format(d, "yyyy-MM-dd");
      const doDia = (horariosServico as any[]).filter((h) => {
        if (h.data_especifica) return h.data_especifica === key;
        return h.dia_semana === d.getDay();
      });
      // Estado de cada horário: do próprio aluno, ocupado por outro (mesmo profissional, data e horário) ou livre.
      const chips = doDia
        .filter((h) => horarioFuturoPortal(key, String(h.horario_inicio), agoraVisual))
        .map((h) => {
          const ini = String(h.horario_inicio).slice(0, 5);
          const meu = (servicosFuturos as any[]).find(
            (s) => s.atividade === h.atividade && s.data_especifica === key && String(s.horario_inicio).slice(0, 5) === ini,
          );
          if (meu) return { h, estado: "meu" as const, meuId: meu.id as string };
          const ocupado = ocupadosSet.has(`${h.profissional_id ?? ""}|${key}|${ini}`);
          return { h, estado: ocupado ? ("ocupado" as const) : ("livre" as const), meuId: null };
        });
      if (chips.length > 0) {
        map[key] = chips.sort((a, b) => String(a.h.horario_inicio).localeCompare(String(b.h.horario_inicio)));
      }
    }
    return map;
  }, [horariosServico, dias14, ocupadosSet, agoraVisual, servicosFuturos]);

  const { data: profissionaisNomes = {} } = useQuery({
    queryKey: ["portal-servico-profissionais", profissionaisHorarios.join(",")],
    enabled: profissionaisHorarios.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", profissionaisHorarios as string[]);
      const map: Record<string, string> = {};
      for (const p of (data as any[]) || []) map[p.id] = p.full_name;
      return map;
    },
  });

  // Regra mensal de Recovery (Pro/Corrida): saldo do ciclo e data de renovação.
  const { data: recoveryMensal } = useQuery({
    queryKey: ["portal-recovery-mensal", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("fn_recovery_mensal_meu");
      return (data ?? null) as { ativo: boolean; total: number; saldo: number; renova_em: string } | null;
    },
  });

  // Compra avulsa de Recovery: valor sempre lido do catálogo.
  const { data: precoRecoveryAvulso } = useQuery({
    queryKey: ["portal-recovery-avulso-preco"],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("fn_portal_recovery_avulso_preco");
      const v = Number(data);
      return Number.isFinite(v) && v > 0 ? v : null;
    },
  });

  const comprarRecovery = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_portal_recovery_avulso_link");
      if (error || !data?.token) throw new Error(error?.message ?? "sem_link");
      return String(data.token);
    },
    onSuccess: (token) => {
      window.location.assign(`/pagamento/${token}`);
    },
    onError: () => toast.error("Não foi possível abrir o pagamento agora. Tente novamente."),
  });

  const abrirWhatsAppServico = (label: string) =>
    window.open(
      "https://wa.me/555135199451?text=" + encodeURIComponent(`Olá! Quero saber sobre o serviço ${label}.`),
      "_blank",
    );


  // Só dias com pelo menos um horário livre (já sem os horários passados de hoje).
  const diasServicoDisponiveis = useMemo(
    () => dias14.filter((d) => (horariosServicoPorDia[format(d, "yyyy-MM-dd")]?.length ?? 0) > 0),
    [dias14, horariosServicoPorDia]
  );


  // Histórico de treinos (passados)
  const { data: historicoTreinos = [] } = useQuery({
    queryKey: ["portal-historico-treinos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("treino_agendamentos")
        .select("id, data, horario_inicio, horario_fim, status, treino_slots(modalidade)")
        .eq("aluno_id", student!.id)
        .lte("data", format(new Date(), "yyyy-MM-dd"))
        .in("status", ["realizado", "faltou", "cancelado"])
        .order("data", { ascending: false })
        .limit(60);
      return (data || []) as Agendamento[];
    },
  });

  // Regra: cancelamento só estorna crédito com 8h+ de antecedência
  const servicoDentroPrazo = (s: any) => {
    if (!s?.data_especifica) return false;
    const inicio = new Date(`${s.data_especifica}T${(s.horario_inicio || "00:00:00").slice(0, 8)}`);
    return inicio.getTime() - Date.now() >= 8 * 60 * 60 * 1000;
  };

  // Histórico de serviços (atendimentos já realizados)
  const { data: historicoServicos = [] } = useQuery({
    queryKey: ["portal-historico-servicos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("agenda_servicos")
        .select("id, atividade, local, data_especifica, horario_inicio")
        .eq("aluno_id", student!.id)
        .lt("data_especifica", format(new Date(), "yyyy-MM-dd"))
        .order("data_especifica", { ascending: false })
        .limit(30);
      return (data || []) as any[];
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
        description:
          result.creditos_restantes == null
            ? "Sua vaga está confirmada."
            : `${result.creditos_restantes} crédito(s) restante(s).`,
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
        sem_plano_corrida: "Este horário é exclusivo para alunos com plano de Corrida ativo. Fale com a equipe para contratar.",
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

  const agendarServico = useMutation({
    mutationFn: async ({ agendaId, data }: { agendaId: string; data: string }) => {
      const { data: result, error } = await (supabase as any).rpc("fn_agendar_servico", {
        p_agenda_servico_id: agendaId,
        p_data: data,
      });
      if (error) throw error;
      const r = result as any;
      if (!r?.ok) {
        const err = new Error(r?.erro || "erro");
        (err as any).detalhe = r?.detalhe;
        throw err;
      }
      return r;
    },
    onSuccess: () => {
      toast.success("Serviço agendado!", {
        description:
          "Sua vaga está confirmada. Cancelamentos devem ser feitos com até 8h de antecedência para manter o crédito.",
      });
      qc.invalidateQueries({ queryKey: ["portal-agenda-servicos-creditos"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-horarios-servico"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-reservas-servico"] });
      qc.invalidateQueries({ queryKey: ["portal-historico-servicos"] });
      qc.invalidateQueries({ queryKey: ["portal-servicos-futuros"] });
      qc.invalidateQueries({ queryKey: ["portal-recovery-mensal"] });
    },
    onError: (e: any) => {
      // eslint-disable-next-line no-console
      console.error("fn_agendar_servico erro:", e.message, e?.detalhe || "");
      const msgs: Record<string, string> = {
        sem_creditos: "Você não tem créditos disponíveis para este serviço.",
        sem_vaga: "Esse horário já foi reservado por outro aluno.",
        horario_passado: "Esse horário já passou. Escolha outro.",
        horario_invalido: "Horário indisponível.",
        aluno_nao_encontrado: "Não foi possível identificar seu cadastro.",
        erro_interno: "Não foi possível agendar. Tente novamente em instantes.",
      };
      toast.error(msgs[e.message] || "Erro ao agendar. Tente novamente.");
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

  const cancelarServico = useMutation({
    mutationFn: async (agendaId: string) => {
      const { data: result, error } = await (supabase as any).rpc("fn_cancelar_agendamento_servico", {
        p_agenda_id: agendaId,
      });
      if (error) throw error;
      const r = result as any;
      if (!r?.ok) throw new Error(r?.erro || "erro");
      return r;
    },
    onSuccess: (result: any) => {
      toast.success("Serviço cancelado", {
        description: result?.credito_estornado
          ? "Seu crédito foi estornado."
          : "Como faltavam menos de 8h, o crédito não foi estornado.",
      });
      setCancelandoServico(null);
      qc.invalidateQueries({ queryKey: ["portal-servicos-futuros"] });
      qc.invalidateQueries({ queryKey: ["portal-recovery-mensal"] });
      qc.invalidateQueries({ queryKey: ["portal-historico-servicos"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-servicos-creditos"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-consumos"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-reservas-servico"] });
      qc.invalidateQueries({ queryKey: ["portal-agenda-horarios-servico"] });
    },
    onError: (e: any) => {
      const msgs: Record<string, string> = {
        data_passada: "Não é possível cancelar um atendimento que já passou.",
        nao_autorizado: "Este agendamento não pertence a você.",
        agendamento_nao_encontrado: "Agendamento não encontrado.",
      };
      toast.error(msgs[e.message] || "Erro ao cancelar.");
    },
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
            AGENDAR TREINO
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Escolha o melhor horário na semana</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-3 py-2 text-right">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Créditos</p>
          <p className="text-xl font-black text-primary" style={{ fontFamily: "Archivo, sans-serif" }}>{saldo}</p>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex border-b border-[#4A4B4B]" role="tablist">
        {[
          { key: "treinos", label: "Treinos" },
          { key: "servicos", label: "Serviços" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAbaAgenda(tab.key as any)}
            role="tab"
            aria-selected={abaAgenda === tab.key}
            className={`min-h-[44px] flex-1 border-b-2 text-[13px] font-bold uppercase tracking-[0.08em] ${
              abaAgenda === tab.key ? "border-foreground text-foreground" : "border-transparent text-[#B1B3B3]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {abaAgenda === "treinos" && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setMeusAgendamentosAberto(true)}
            className="w-full min-h-[64px] flex items-center gap-3 border border-[#4A4B4B] bg-[#1A1A1A] px-4 text-left"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            <CalendarDays className="w-5 h-5 shrink-0 text-[#B1B3B3]" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Meus agendamentos</p>
              <p className="text-xs text-[#B1B3B3] truncate">
                {(() => {
                  const prox = [...meusAgendamentos].sort((a, b) => `${a.data} ${a.horario_inicio}`.localeCompare(`${b.data} ${b.horario_inicio}`))[0];
                  if (!prox) return "Nenhum treino agendado.";
                  const d = parseISO(prox.data + "T12:00:00");
                  const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agoraVisual);
                  const amanhaSP = format(addDays(parseISO(hojeSP + "T12:00:00"), 1), "yyyy-MM-dd");
                  const dia = prox.data === hojeSP ? "hoje" : prox.data === amanhaSP ? "amanhã" : format(d, "EEE, dd/MM", { locale: ptBR });
                  return `Próximo: ${dia}, ${prox.horario_inicio?.slice(0, 5)}`;
                })()}
              </p>
            </div>
            <span className="min-w-[28px] h-7 px-2 flex items-center justify-center border border-[#4A4B4B] text-xs font-bold text-foreground">
              {meusAgendamentos.length}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
          {/* ── SEÇÃO HORÁRIO FIXO ── */}
          {(() => {
            const planoTipo = planoPortal?.tipo ?? "";
            const freq = planoPortal?.frequencia_semanal ?? 1;
            const elegivel = ["Power", "Pro", "Max"].includes(planoTipo);
            const DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
            return (
              <section className="space-y-2">
                <div
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden transition-colors",
                    horarioFixoAberto ? "border-border" : "border-border hover:border-primary/30"
                  )}
                >
                  <button
                    onClick={() => setHorarioFixoAberto((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                        <Pin className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {elegivel ? `Horário fixo ${horariosFixos.length} de ${freq}` : "Horário fixo"}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                        horarioFixoAberto && "rotate-180"
                      )}
                    />
                  </button>

                  {horarioFixoAberto && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                      {!elegivel ? (
                        <div className="pt-3 space-y-3">
                          <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-foreground">Exclusivo Power e Pro</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Garanta seu horário toda semana automaticamente, sem precisar agendar manualmente.
                          </p>
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5 text-xs text-amber-200">
                            <p className="font-semibold text-amber-100">Por que está indisível?</p>
                            <p>O Horário Fixo é vinculado ao seu <strong className="text-amber-100">plano principal de Treinamento Funcional</strong>. Planos adicionais (como Corrida) não liberam esse benefício sozinhos.</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                            <p>A partir do plano <strong className="text-foreground">Power</strong>, você pode fixar horários conforme sua frequência semanal contratada.</p>
                            <p>Exemplo: se você treina <strong className="text-foreground">3×/semana</strong>, pode fixar até <strong className="text-foreground">3 horários</strong> automaticamente.</p>
                          </div>
                          <button
                            onClick={() => window.open('https://wa.me/555135199451?text=Olá! Quero fazer upgrade do meu plano para ter horário fixo.', '_blank')}
                            className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
                          >
                            Fazer upgrade e garantir meu horário
                          </button>
                        </div>
                      ) : horariosFixos.length === 0 ? (
                        <div className="pt-3 space-y-3">
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
                        <div className="pt-3 space-y-2">
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
                                    {pausado ? `Pausado até ${format(parseISO(hf.pausado_ate + "T12:00:00"), "dd/MM/yyyy")}` : "Reserva automática toda semana"}
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
                    </div>
                  )}
                </div>
              </section>
            );
          })()}
      {(() => {
        const isCorrida = modalidadeTreino === "corrida";
        const lista = (isCorrida ? slotsCorrida : slotsTreino).filter((slot) =>
          horarioFuturoPortal(dataStr, slot.horario_inicio, agoraVisual)
        );
        const diasSet = isCorrida ? diasComSlotsCorrida : diasComSlotsTreino;
        const bloqueadoCorrida = isCorrida && !temPlanoCorrida;
        return (<>
      {/* Calendário semanal horizontal */}
      <section className="space-y-2">
        <SectionLabel>Agendar treino</SectionLabel>
        <div className="flex border border-[#4A4B4B]" role="group" aria-label="Modalidade">
          {(["funcional", "corrida"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModalidadeTreino(m)}
              aria-pressed={modalidadeTreino === m}
              className={cn(
                "min-h-[44px] flex-1 text-[13px] font-bold uppercase tracking-[0.08em]",
                modalidadeTreino === m ? "bg-[#1A1A1A] text-foreground" : "text-[#B1B3B3]"
              )}
            >
              {m === "funcional" ? "Funcional" : "Corrida"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {dias7.map((d) => {
            const ativo = isSameDay(d, diaSelecionado);
            const temSlots = diasSet.has(d.getDay());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDiaSelecionado(d)}
                className={cn(
                  "min-w-[62px] snap-start rounded-2xl border py-3 px-2 text-center transition-all relative",
                  ativo
                    ? "bg-[#C8282A] border-[#C8282A] text-white"
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

      {bloqueadoCorrida && (
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">Disponível apenas para alunos com plano de Corrida</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Você pode ver os horários, mas o agendamento é exclusivo para quem tem um plano de Corrida ativo.
          </p>
          <button
            onClick={() => window.open('https://wa.me/555135199451?text=Olá! Quero contratar o plano de Corrida.', '_blank')}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
          >
            Falar com a equipe sobre o plano de Corrida
          </button>
        </section>
      )}

      {/* Slots do dia — grade por período */}
      <section className="space-y-4" style={{ fontFamily: "Archivo, sans-serif" }}>
        <SectionLabel>{format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}</SectionLabel>
        {lista.length === 0 ? (
          <div className="bg-card border border-border p-8 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agoraVisual) === dataStr ? "Não há mais horários hoje" : "Sem horários disponíveis neste dia."}</p>
          </div>
        ) : (
          PERIODOS.map((p) => {
            const doPeriodo = lista.filter((s) => {
              const m = minutosDe(s.horario_inicio);
              return m >= p.de && m <= p.ate;
            });
            if (doPeriodo.length === 0) return null;
            return (
              <div key={p.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">{p.label}</p>
                  <span aria-hidden className="h-px flex-1 bg-[#4A4B4B]" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {doPeriodo.map((slot) => {
                    const ocupadas = agendamentosDia.filter((a) => a.slot_id === slot.id).length;
                    const vagas = Math.max(0, slot.capacidade_maxima - ocupadas);
                    const meu = agendamentosDia.find((a) => a.slot_id === slot.id && a.aluno_id === student?.id);
                    const jaTemNoDia = meusAgendamentos.some(
                      (a) => a.data === dataStr && (((a as any).treino_slots?.modalidade === "corrida") === isCorrida)
                    );
                    const lotado = ocupadas >= slot.capacidade_maxima;
                    const instrutorNome = slot.instrutor_id ? instrutores[slot.instrutor_id] : null;
                    const semCreditos = !isCorrida && saldo <= 0;
                    const ini = slot.horario_inicio.slice(0, 5);

                    if (meu) {
                      const rotulo = meu.status === "realizado" ? "REALIZADO" : meu.status === "faltou" ? "FALTA" : "AGENDADO";
                      const cancelavel = meu.status === "agendado" || meu.status === "confirmado";
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => cancelavel && setCancelando(meu.id)}
                          aria-label={`${ini}, ${rotulo.toLowerCase()}`}
                          className="h-14 border-2 border-[#4CC38A] bg-[#1A1A1A] flex flex-col items-center justify-center leading-none"
                        >
                          <span className="text-[18px] font-bold text-foreground">{ini}</span>
                          <span className="mt-1 text-[12px] font-bold text-[#4CC38A]">✓ {rotulo}</span>
                        </button>
                      );
                    }
                    if (lotado) {
                      return (
                        <div
                          key={slot.id}
                          aria-label={`${ini}, lotado`}
                          className="h-14 border border-dashed border-[#4A4B4B] flex flex-col items-center justify-center leading-none text-[#B1B3B3]"
                        >
                          <span className="text-[18px] font-bold">{ini}</span>
                          <span className="mt-1 text-[12px] font-bold">LOTADO</span>
                        </div>
                      );
                    }
                    const quase = vagas <= 2;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        aria-label={`${ini}, ${vagas} ${vagas === 1 ? "vaga" : "vagas"}`}
                        onClick={() => {
                          if (bloqueadoCorrida) {
                            toast.error("Este horário é exclusivo para alunos com plano de Corrida ativo. Fale com a equipe para contratar.");
                            return;
                          }
                          if (jaTemNoDia) {
                            toast.error("Você já tem um treino agendado neste dia.");
                            return;
                          }
                          if (semCreditos) {
                            toast.error("Você não tem créditos disponíveis.");
                            return;
                          }
                          setConfirmando({ slot, data: dataStr, instrutor: instrutorNome ?? undefined });
                        }}
                        className={cn(
                          "h-14 border border-[#4A4B4B] bg-[#1A1A1A] flex flex-col items-center justify-center leading-none",
                          (bloqueadoCorrida || jaTemNoDia || semCreditos) && "opacity-60"
                        )}
                      >
                        <span className="text-[18px] font-bold text-foreground">{ini}</span>
                        <span className={cn("mt-1 text-[12px]", quase ? "text-[#E3B341]" : "text-[#B1B3B3]")}>
                          {vagas} {vagas === 1 ? "vaga" : "vagas"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <p className="text-xs text-[#B1B3B3]">Cancelando com menos de 1 hora de antecedência, o crédito não é devolvido.</p>
      </section>
      </>);
      })()}
        </div>
      )}

      {abaAgenda === "servicos" && (() => {
        const diaEfetivo = diaServico && diasServicoDisponiveis.some((d) => isSameDay(d, diaServico))
          ? diaServico
          : diasServicoDisponiveis[0] ?? null;
        const diaServicoStr = diaEfetivo ? format(diaEfetivo, "yyyy-MM-dd") : null;
        const chipsDoDia = diaServicoStr ? horariosServicoPorDia[diaServicoStr] ?? [] : [];
        const servicoAtual = SERVICOS_PORTAL.find((s) => s.atividade === servicoSelecionado) ?? null;
        const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agoraVisual);
        return (
        <div className="space-y-6" style={{ fontFamily: "Archivo, sans-serif" }}>
          <button
            type="button"
            onClick={() => setMeusAgendamentosAberto(true)}
            className="w-full min-h-[64px] flex items-center gap-3 border border-[#4A4B4B] bg-[#1A1A1A] px-4 text-left"
          >
            <CalendarDays className="w-5 h-5 shrink-0 text-[#B1B3B3]" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Meus agendamentos</p>
              <p className="text-xs text-[#B1B3B3] truncate">
                {servicosFuturos.length === 0
                  ? "Nenhum serviço agendado."
                  : `Próximo: ${servicosFuturos[0].atividade}, ${format(parseISO(servicosFuturos[0].data_especifica + "T12:00:00"), "dd/MM")} ${String(servicosFuturos[0].horario_inicio).slice(0, 5)}`}
              </p>
            </div>
            <span className="min-w-[28px] h-7 px-2 flex items-center justify-center border border-[#4A4B4B] text-xs font-bold text-foreground">
              {meusAgendamentos.length + servicosFuturos.length}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <section className="space-y-2">
            <SectionLabel>Agendar serviço</SectionLabel>
            {SERVICOS_PORTAL.map(({ label, atividade }) => {
              const info = saldoPorAtividade[atividade];
              const saldoS = info?.saldo ?? 0;
              const { icon: Icon } = iconServico(atividade);
              const ativo = servicoSelecionado === atividade;
              const mensal = atividade === RECOVERY && recoveryMensal?.ativo ? recoveryMensal : null;
              return (
                <button
                  key={atividade}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => { setServicoSelecionado(ativo ? null : atividade); setDiaServico(null); }}
                  className={cn(
                    "w-full min-h-[64px] flex items-center gap-3 border px-4 py-3 text-left",
                    ativo ? "border-[#C8282A] bg-[#1A1A1A]" : "border-[#4A4B4B] bg-[#1A1A1A]"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0 text-[#C8282A]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">{label}</p>
                    <p className="text-xs text-[#B1B3B3]">
                      {mensal
                        ? `${mensal.saldo} de ${mensal.total} sessões neste ciclo · renova em ${format(parseISO(mensal.renova_em + "T12:00:00"), "dd/MM")}`
                        : info?.ilimitado
                          ? "Ilimitado"
                          : saldoS > 0
                            ? `${saldoS} ${saldoS === 1 ? "sessão disponível" : "sessões disponíveis"}`
                            : "Sem créditos"}
                    </p>
                    {mensal && saldoS > mensal.saldo && (
                      <p className="text-xs text-[#B1B3B3]">{saldoS} no total, com sessões avulsas</p>
                    )}
                  </div>
                  {ativo ? <ChevronDown className="w-4 h-4 text-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              );
            })}
          </section>

          {servicoAtual && (
            <section className="space-y-4">
              <SectionLabel>{servicoAtual.label}</SectionLabel>
              {diasServicoDisponiveis.length === 0 ? (
                <div className="border border-[#4A4B4B] bg-[#1A1A1A] p-6 text-center space-y-3">
                  <p className="text-sm text-[#B1B3B3]">Sem horários nos próximos 14 dias.</p>
                  <button
                    onClick={() => abrirWhatsAppServico(servicoAtual.label)}
                    className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
                  >
                    Falar com a equipe
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                    {diasServicoDisponiveis.map((d) => {
                      const sel = !!diaEfetivo && isSameDay(d, diaEfetivo);
                      return (
                        <button
                          key={d.toISOString()}
                          onClick={() => setDiaServico(d)}
                          aria-pressed={sel}
                          className={cn(
                            "min-w-[62px] min-h-[64px] snap-start border py-3 px-2 text-center",
                            sel ? "bg-[#C8282A] border-[#C8282A] text-white" : "bg-[#1A1A1A] border-[#4A4B4B] text-foreground"
                          )}
                        >
                          <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{DIA_ABREV[d.getDay()]}</div>
                          <div className="text-xl font-black mt-0.5">{d.getDate()}</div>
                        </button>
                      );
                    })}
                  </div>

                  {diaEfetivo && <SectionLabel>{format(diaEfetivo, "EEEE, dd 'de' MMMM", { locale: ptBR })}</SectionLabel>}

                  {PERIODOS.map((p) => {
                    const doPeriodo = chipsDoDia.filter((c: any) => {
                      const m = minutosDe(c.h.horario_inicio);
                      return m >= p.de && m <= p.ate;
                    });
                    if (doPeriodo.length === 0) return null;
                    return (
                      <div key={p.key} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">{p.label}</p>
                          <span aria-hidden className="h-px flex-1 bg-[#4A4B4B]" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {doPeriodo.map((c: any) => {
                            const ini = String(c.h.horario_inicio).slice(0, 5);
                            const key = `${c.h.id}-${diaServicoStr}`;
                            if (c.estado === "meu") {
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => c.meuId && setCancelandoServico(c.meuId)}
                                  aria-label={`${ini}, agendado`}
                                  className="h-14 border-2 border-[#4CC38A] bg-[#1A1A1A] flex flex-col items-center justify-center leading-none"
                                >
                                  <span className="text-[18px] font-bold text-foreground">{ini}</span>
                                  <span className="mt-1 text-[12px] font-bold text-[#4CC38A]">AGENDADO</span>
                                </button>
                              );
                            }
                            if (c.estado === "ocupado") {
                              return (
                                <div
                                  key={key}
                                  aria-label={`${ini}, ocupado`}
                                  className="h-14 border border-dashed border-[#4A4B4B] flex flex-col items-center justify-center leading-none text-[#B1B3B3]"
                                >
                                  <span className="text-[18px] font-bold">{ini}</span>
                                  <span className="mt-1 text-[12px] font-bold">OCUPADO</span>
                                </div>
                              );
                            }
                            return (
                              <button
                                key={key}
                                type="button"
                                aria-label={`${ini}, livre`}
                                onClick={() => setConfirmandoServico({ h: c.h, data: diaServicoStr!, label: servicoAtual.label })}
                                className="h-14 border border-[#4A4B4B] bg-[#1A1A1A] flex flex-col items-center justify-center leading-none"
                              >
                                <span className="text-[18px] font-bold text-foreground">{ini}</span>
                                <span className="mt-1 text-[12px] font-bold text-[#C8282A]">AGENDAR</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {diaServicoStr === hojeSP && chipsDoDia.length === 0 && (
                    <p className="text-sm text-[#B1B3B3]">Não há mais horários hoje</p>
                  )}
                </>
              )}
              <p className="text-xs text-[#B1B3B3]">Cancelando com 8 horas ou mais de antecedência, o crédito é devolvido. Depois disso, não é devolvido.</p>
            </section>
          )}
        </div>
        );
      })()}

      <div className="space-y-3">
          {/* ── SINCRONIZAR CALENDÁRIO ── */}
          <section className="space-y-2">
            <div
              className={cn(
                "bg-card border rounded-2xl overflow-hidden transition-colors cursor-pointer",
                calendarioAberto ? "border-border" : "border-border hover:border-primary/30"
              )}
            >
              <button
                onClick={() => setCalendarioAberto((v) => !v)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                    <CalendarPlus className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    Integrar com calendário do celular
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                    calendarioAberto && "rotate-180"
                  )}
                />
              </button>

              {calendarioAberto && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground pt-3">
                    Seus treinos e serviços aparecem automaticamente no seu calendário.
                  </p>

                  {calendarTokenError && !feedHttpsUrl ? (
                    <div className="flex flex-col gap-1 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-destructive flex-1">
                          Não foi possível gerar o link do calendário.
                        </p>
                        <button
                          onClick={() => void refetchCalendarToken()}
                          disabled={calendarTokenFetching}
                          className="text-[11px] font-bold text-primary shrink-0 disabled:opacity-40"
                        >
                          {calendarTokenFetching ? "Tentando…" : "Tentar novamente"}
                        </button>
                      </div>
                      {calendarTokenErrorObj && (
                        <p className="text-[10px] text-destructive/80 font-mono break-all">
                          {(calendarTokenErrorObj as any).code ? `[${(calendarTokenErrorObj as any).code}] ` : ""}
                          {(calendarTokenErrorObj as Error).message}
                        </p>
                      )}
                    </div>
                  ) : (
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
                  )}


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
              )}
            </div>
          </section>
        <section className="space-y-2">
          <button
            onClick={() => setHistoricoAberto((v) => !v)}
            aria-expanded={historicoAberto}
            className="flex min-h-[44px] w-full items-center justify-between px-1 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]"
          >
            Histórico
            <ChevronDown className={cn("h-4 w-4 transition-transform", historicoAberto && "rotate-180")} />
          </button>
          {historicoAberto && (
            <div className="space-y-2">
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
            </div>
          )}
        </section>
      </div>





      {/* Folha inferior: confirmar treino */}
      {confirmando && (() => {
        const ini = confirmando.slot.horario_inicio.slice(0, 5);
        const fim = confirmando.slot.horario_fim.slice(0, 5);
        const [hh, mm] = ini.split(":").map(Number);
        const limiteMin = (hh * 60 + mm - 60 + 1440) % 1440;
        const limite = `${String(Math.floor(limiteMin / 60)).padStart(2, "0")}:${String(limiteMin % 60).padStart(2, "0")}`;
        const corrida = confirmando.slot.modalidade === "corrida";
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => !agendar.isPending && setConfirmando(null)}>
            <div
              role="dialog"
              aria-label="Confirmar treino"
              className="w-full max-h-[100dvh] overflow-y-auto border-t border-[#4A4B4B] bg-card px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
              style={{ fontFamily: "Archivo, sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Confirmar treino</p>
              <div>
                <p className="text-[32px] font-black leading-tight text-foreground">{ini} → {fim}</p>
                <p className="mt-1 text-sm text-foreground first-letter:uppercase">
                  {format(parseISO(confirmando.data), "EEEE, dd 'de' MMMM", { locale: ptBR })} · {corrida ? "Corrida" : "Funcional"}
                </p>
                {confirmando.instrutor && <p className="text-xs text-[#B1B3B3]">Instrutor: {confirmando.instrutor}</p>}
              </div>
              <div className="divide-y divide-[#4A4B4B] border-y border-[#4A4B4B]">
                <div className="py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Crédito</p>
                  <p className="mt-1 text-sm text-foreground">
                    {corrida ? "Horários de Corrida não consomem créditos." : "Usa 1 crédito do seu plano."}
                  </p>
                </div>
                <div className="py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Cancelamento</p>
                  <p className="mt-1 text-sm text-foreground">
                    Gratuito até 1 hora antes ({limite}). Depois disso, o crédito não é devolvido.
                  </p>
                </div>
              </div>
              <button
                onClick={() => agendar.mutate({ slotId: confirmando.slot.id, data: confirmando.data })}
                disabled={agendar.isPending}
                className="min-h-[52px] w-full bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
              >
                {agendar.isPending ? "Agendando…" : "Confirmar agendamento"}
              </button>
              <button
                onClick={() => setConfirmando(null)}
                disabled={agendar.isPending}
                className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
              >
                Voltar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Folha inferior: confirmar serviço */}
      {confirmandoServico && (() => {
        const { h, data, label } = confirmandoServico;
        const ativ = String(h.atividade);
        const info = saldoPorAtividade[ativ];
        const ilim = !!info?.ilimitado;
        const saldoS = info?.saldo ?? 0;
        const semCredito = !ilim && saldoS <= 0;
        const ini = String(h.horario_inicio).slice(0, 5);
        const fim = String(h.horario_fim).slice(0, 5);
        const prof = h.profissional_id ? profissionaisNomes[h.profissional_id] : null;
        const fechar = () => !agendarServico.isPending && setConfirmandoServico(null);
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={fechar}>
            <div
              role="dialog"
              aria-label={`Confirmar ${label}`}
              className="w-full max-h-[100dvh] overflow-y-auto border-t border-[#4A4B4B] bg-card px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
              style={{ fontFamily: "Archivo, sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Confirmar {label}</p>
              <div>
                <p className="text-[32px] font-black leading-tight text-foreground">{ini} → {fim}</p>
                <p className="mt-1 text-sm text-foreground first-letter:uppercase">
                  {format(parseISO(data + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                {h.local && <p className="text-xs text-[#B1B3B3]">Local: {h.local}</p>}
                {prof && <p className="text-xs text-[#B1B3B3]">Profissional: {prof}</p>}
              </div>
              {semCredito ? (
                <>
                  <div className="border-y border-[#4A4B4B] py-3">
                    <p className="text-sm text-foreground">Você não tem créditos para este serviço.</p>
                  </div>
                  {ativ === RECOVERY && precoRecoveryAvulso && (
                    <button
                      onClick={() => comprarRecovery.mutate()}
                      disabled={comprarRecovery.isPending}
                      className="min-h-[52px] w-full bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                    >
                      {comprarRecovery.isPending
                        ? "Abrindo pagamento…"
                        : `Comprar 1 sessão por ${precoRecoveryAvulso.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                    </button>
                  )}
                  <button
                    onClick={() => abrirWhatsAppServico(label)}
                    className={cn(
                      "min-h-[52px] w-full text-[13px] font-bold uppercase tracking-[0.08em]",
                      ativ === RECOVERY && precoRecoveryAvulso
                        ? "border border-[#4A4B4B] text-foreground"
                        : "bg-[#C8282A] text-white",
                    )}
                  >
                    Falar com a equipe
                  </button>
                </>
              ) : (
                <>
                  <div className="divide-y divide-[#4A4B4B] border-y border-[#4A4B4B]">
                    <div className="py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Crédito</p>
                      <p className="mt-1 text-sm text-foreground">
                        {ilim ? "Usa 1 sessão. Seu saldo é ilimitado." : `Usa 1 crédito. Saldo depois: ${Math.max(saldoS - 1, 0)}.`}
                      </p>
                    </div>
                    <div className="py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Cancelamento</p>
                      <p className="mt-1 text-sm text-foreground">
                        Com 8 horas ou mais de antecedência, o crédito é devolvido. Depois disso, não é devolvido.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => agendarServico.mutate(
                      { agendaId: h.id, data },
                      { onSettled: () => setConfirmandoServico(null) },
                    )}
                    disabled={agendarServico.isPending}
                    className="min-h-[52px] w-full bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                  >
                    {agendarServico.isPending ? "Agendando…" : "Confirmar agendamento"}
                  </button>
                </>
              )}
              <button
                onClick={fechar}
                disabled={agendarServico.isPending}
                className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
              >
                Voltar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Folha inferior: meus agendamentos */}
      {meusAgendamentosAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setMeusAgendamentosAberto(false)}>
          <div
            role="dialog"
            aria-label="Meus agendamentos"
            className="w-full max-h-[100dvh] flex flex-col border-t border-[#4A4B4B] bg-card"
            style={{ fontFamily: "Archivo, sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#4A4B4B] shrink-0">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Meus agendamentos</p>
              <button onClick={() => setMeusAgendamentosAberto(false)} aria-label="Fechar" className="w-11 h-11 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
              {meusAgendamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum treino agendado.</p>
              ) : meusAgendamentos.map((ag: any) => {
                const deadline = new Date(`${ag.data}T${ag.horario_inicio}`);
                deadline.setHours(deadline.getHours() - 1);
                const dentroDoPrazo = new Date() < deadline;
                return (
                  <div key={ag.id} className="border border-[#4A4B4B] p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[44px] shrink-0">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          {format(parseISO(ag.data + "T12:00:00"), "EEE", { locale: ptBR })}
                        </p>
                        <p className="text-2xl font-black text-foreground">{format(parseISO(ag.data + "T12:00:00"), "d")}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">
                          {ag.horario_inicio?.slice(0, 5)} → {ag.horario_fim?.slice(0, 5)}
                          {ag.treino_slots?.modalidade === "corrida" ? " · Corrida" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(ag.data + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                      <button
                        onClick={() => setCancelando(ag.id)}
                        className="min-h-[44px] px-4 border border-[#4A4B4B] text-xs font-bold uppercase tracking-[0.08em] text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                    {!dentroDoPrazo && (
                      <p className="mt-2 text-[11px] text-[#E3B341]">Cancelamento fora do prazo não estorna crédito</p>
                    )}
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-[#E3B341]">Cancelando com menos de 1 hora de antecedência, o crédito não é devolvido.</p>
              <button
                onClick={() => { setMeusAgendamentosAberto(false); setShowHistoricoTreinos(true); }}
                className="w-full min-h-[44px] flex items-center justify-between border border-[#4A4B4B] px-4"
              >
                <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Histórico de treinos</span>
                <span className="flex items-center gap-2">
                  {historicoTreinos.length > 0 && <span className="text-xs font-bold text-[#B1B3B3]">{historicoTreinos.length}</span>}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </span>
              </button>
              {servicosFuturos.length > 0 && (
                <p className="pt-3 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Serviços</p>
              )}
              {servicosFuturos.map((s: any) => (
                <div key={s.id} className="border border-[#4A4B4B] p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[44px] shrink-0">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {format(parseISO(s.data_especifica + "T12:00:00"), "EEE", { locale: ptBR })}
                      </p>
                      <p className="text-2xl font-black text-foreground">{format(parseISO(s.data_especifica + "T12:00:00"), "d")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {s.horario_inicio?.slice(0, 5)}{s.horario_fim ? ` → ${s.horario_fim.slice(0, 5)}` : ""} · {s.atividade}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(parseISO(s.data_especifica + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                        {s.local ? ` · ${s.local}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setCancelandoServico(s.id)}
                      className="min-h-[44px] px-4 border border-[#4A4B4B] text-xs font-bold uppercase tracking-[0.08em] text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                  {!servicoDentroPrazo(s) && (
                    <p className="mt-2 text-[11px] text-[#E3B341]">Faltam menos de 8 horas: cancelar agora não devolve o crédito.</p>
                  )}
                </div>
              ))}
              <button
                onClick={() => { setMeusAgendamentosAberto(false); setShowHistoricoServicos(true); }}
                className="w-full min-h-[44px] flex items-center justify-between border border-[#4A4B4B] px-4"
              >
                <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Histórico de serviços</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog cancelar */}
      {cancelando && (() => {
        const ag = meusAgendamentos.find(a => a.id === cancelando);
        if (!ag) return null;
        const deadline = new Date(`${ag.data}T${ag.horario_inicio}`);
        deadline.setHours(deadline.getHours() - 1);
        const dentroDoprazo = new Date() < deadline;
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end">
            <div className="bg-card border border-border rounded-t-2xl w-full p-6 space-y-4">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Cancelar treino?</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(ag.data), "EEEE, dd 'de' MMMM", {locale: ptBR})} às {ag.horario_inicio.slice(0,5)}
              </p>
              <p className="text-xs text-[#E3B341]">Cancelando com menos de 1 hora de antecedência, o crédito não é devolvido.</p>
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
                  <p className="text-xs text-emerald-400">Crédito será estornado automaticamente.</p>
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

      {/* Dialog cancelar serviço */}
      {cancelandoServico && (() => {
        const s = servicosFuturos.find((x: any) => x.id === cancelandoServico);
        if (!s) return null;
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end">
            <div className="bg-card border border-border rounded-t-2xl w-full p-6 space-y-4">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Cancelar serviço?</p>
              <p className="text-sm text-muted-foreground">
                {s.atividade} · {format(parseISO(s.data_especifica + "T12:00:00"), "EEEE, dd 'de' MMMM", {locale: ptBR})} às {s.horario_inicio?.slice(0,5)}
              </p>
              {servicoDentroPrazo(s) ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-xs text-emerald-400">Crédito será estornado automaticamente.</p>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-400">
                    Faltam menos de 8h para o atendimento — o crédito <strong>não</strong> será estornado.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setCancelandoServico(null)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">Voltar</button>
                <button
                  onClick={() => cancelarServico.mutate(cancelandoServico)}
                  disabled={cancelarServico.isPending}
                  className="flex-1 py-3 rounded-xl bg-destructive text-white font-bold text-sm"
                >
                  {cancelarServico.isPending ? 'Cancelando...' : 'Cancelar serviço'}
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
                <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Histórico de Treinos</p>
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
                { key: "realizado", label: "Realizados" },
                { key: "faltou", label: "Faltas" },
                { key: "cancelado", label: "Cancelados" },
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">
                          {h.horario_inicio?.slice(0, 5)} → {h.horario_fim?.slice(0, 5)}
                        </p>
                        {h.treino_slots?.modalidade === "corrida" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Corrida
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      h.status === "realizado"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : h.status === "faltou"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {h.status === "realizado" ? "Realizado" : h.status === "faltou" ? "Falta" : "Cancelado"}
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
              <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Histórico de Serviços</p>
              <button onClick={() => setShowHistoricoServicos(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-2 pt-3">
              {historicoServicos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço registrado.</p>
              ) : historicoServicos.map((s: any) => {
                const { icon: Icon } = iconServico(s.atividade ?? "");
                return (
                  <div key={s.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{s.atividade}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.data_especifica ? format(parseISO(s.data_especifica + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", {locale: ptBR}) : "—"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      Realizado
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
          <div
            className="bg-card border-t border-[#4A4B4B] w-full max-h-[100dvh] flex flex-col"
            style={{ fontFamily: "Archivo, sans-serif" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-3 shrink-0">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Novo horário fixo</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Dia da semana</p>
                <div className="grid grid-cols-4 gap-2">
                  {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => { setDiaFixo(i); setSlotFixo(""); }}
                      aria-pressed={diaFixo === i}
                      className={`min-h-[44px] text-xs font-bold uppercase tracking-[0.08em] border ${diaFixo === i ? "bg-[#C8282A] border-[#C8282A] text-white" : "border-[#4A4B4B] text-[#B1B3B3]"}`}
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
                        aria-pressed={slotFixo === s.id}
                        className={`w-full min-h-[44px] flex items-center gap-3 p-3 border text-left ${slotFixo === s.id ? "border-[#C8282A] bg-[#C8282A]/10" : "bg-background border-[#4A4B4B]"}`}
                      >
                        <p className="text-sm font-semibold text-foreground">{s.horario_inicio.slice(0,5)} → {s.horario_fim.slice(0,5)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#4A4B4B] bg-card px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
              <button onClick={() => { setShowAdicionarFixo(false); setSlotFixo(""); }} className="flex-1 min-h-[44px] border border-[#4A4B4B] text-foreground font-bold uppercase tracking-[0.08em] text-[13px]">Cancelar</button>
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
                className="flex-1 min-h-[44px] bg-[#C8282A] text-white font-bold uppercase tracking-[0.08em] text-[13px] disabled:opacity-40"
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
            <p className="text-sm text-muted-foreground">Este horário não será mais reservado automaticamente, e os agendamentos futuros criados por ele serão cancelados.</p>
            <div className="flex gap-3">
              <button onClick={() => setHorarioFixoParaRemover(null)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">Cancelar</button>
              <button
                onClick={async () => {
                  const { data, error } = await (supabase as any).rpc("fn_excluir_horario_fixo", { p_horario_fixo_id: horarioFixoParaRemover });
                  if (error || !data?.ok) {
                    toast.error("Não foi possível remover o horário fixo.");
                  } else {
                    const n = data.cancelados ?? 0;
                    toast.success(n > 0 ? `Horário fixo removido. ${n} agendamento${n > 1 ? "s" : ""} futuro${n > 1 ? "s" : ""} cancelado${n > 1 ? "s" : ""}.` : "Horário fixo removido.");
                  }
                  qc.invalidateQueries({ queryKey: ["portal-horarios-fixos"] });
                  qc.invalidateQueries({ queryKey: ["agendamentos-dia"] });
                  qc.invalidateQueries({ queryKey: ["historicoTreinos"] });
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
