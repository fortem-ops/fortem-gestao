import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, AlertTriangle, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const ATIVIDADES = [
  "Nutrição",
  "Reabilitação",
  "Avaliação Funcional",
  "Avaliação Física",
  "Recovery (Bota de Compressão)",
  "Treino Experimental",
];

const LOCAIS = ["Sala de Nutrição", "Sala de Reabilitação", "Sala de Treinamento"];

const ATIVIDADE_LOCAL_PADRAO: Record<string, string> = {
  "Treino Experimental": "Sala de Treinamento",
  "Reabilitação": "Sala de Reabilitação",
  "Recovery (Bota de Compressão)": "Sala de Reabilitação",
  "Nutrição": "Sala de Nutrição",
  "Avaliação Física": "Sala de Nutrição",
};

const PROSPECT_STAGES = ["Prospect", "Treino experimental agendado"];
const LEAD_STAGE = "Novo lead";

const DIAS_SEMANA = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

// Atividades que consomem créditos (devem bater com creditos_aluno.atividade)
const ATIVIDADES_COM_CREDITO = new Set([
  "Nutrição",
  "Reabilitação",
  "Avaliação Funcional",
  "Avaliação Física",
]);

// Mapeamento entre atividade da agenda e o rótulo do serviço dentro de planos.servicos
const PLAN_SERVICE_LABEL: Record<string, string> = {
  "Avaliação Funcional": "Avaliação Funcional",
  "Nutrição": "Consultas Nutrição",
  "Reabilitação": "Consultas Reabilitação",
};

function parsePlanServiceCount(servicos: string[] | null | undefined, label: string): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const m = s.match(/^(\d+)\s+(.+)$/);
    if (m && m[2] === label) return parseInt(m[1], 10);
  }
  return 0;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: { date: Date; hour: number; minute?: number } | null;
  editEvent?: any | null;
  /** Data da célula clicada na grade (usada para reservar aluno em vaga fixa). */
  cellDate?: Date | null;
}

export function AddAgendaDialog({ open, onOpenChange, prefill, editEvent, cellDate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [atividade, setAtividade] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("avulso");
  const [diaSemana, setDiaSemana] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [novoHorario, setNovoHorario] = useState("16:30");
  const [dataEspecifica, setDataEspecifica] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("09:00");
  const [profissionalId, setProfissionalId] = useState("");
  const [consultorId, setConsultorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [alunoSearch, setAlunoSearch] = useState("");
  const [creditoOrigem, setCreditoOrigem] = useState<"" | "plano" | "servico">("");
  const [protocolo, setProtocolo] = useState("");
  const [visivelPortal, setVisivelPortal] = useState(false);
  const [agendamentoSalvo, setAgendamentoSalvo] = useState<any>(null);
  const [notificando, setNotificando] = useState(false);

  const isEditing = !!editEvent;
  // Modo lote: criação de horários fixos em várias combinações dia × horário
  const modoLote = tipo === "fixo" && !isEditing;

  const somaUmaHora = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const total = (h * 60 + m + 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const toggleDia = (v: string) =>
    setDiasSemana((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));

  const adicionarHorario = () => {
    if (!novoHorario) return;
    setHorarios((prev) => (prev.includes(novoHorario) ? prev : [...prev, novoHorario].sort()));
  };

  const totalLote = diasSemana.length * horarios.length;
  const loteMultiplo = modoLote && totalLote > 1;

  // Data da célula clicada (reserva avulsa a partir de uma vaga fixa)
  const cellDateStr = cellDate ? format(cellDate, "yyyy-MM-dd") : null;
  const editandoFixoUI = isEditing && editEvent?.tipo === "fixo";
  // Aluno indisponível: criando vaga fixa, ou editando modelo fixo sem data de referência
  const alunoBloqueado = modoLote || (editandoFixoUI && !cellDateStr);

  // Apply prefill or editEvent when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setAtividade(editEvent.atividade || "");
      setLocal(editEvent.local || "");
      setTipo(editEvent.tipo || "avulso");
      setDiaSemana(String(editEvent.dia_semana ?? ""));
      setDataEspecifica(editEvent.data_especifica || "");
      setHorarioInicio(editEvent.horario_inicio?.slice(0, 5) || "08:00");
      setHorarioFim(editEvent.horario_fim?.slice(0, 5) || "09:00");
      setProfissionalId(editEvent.profissional_id || "");
      setConsultorId(editEvent.consultor_id || "");
      setObservacoes(editEvent.observacoes || "");
      setAlunoId(editEvent.aluno_id || "");
      setAlunoSearch("");
      setProtocolo(editEvent.protocolo || "");
      setVisivelPortal(!!editEvent.visivel_portal);
    } else if (prefill) {
      const startMin = prefill.hour * 60 + (prefill.minute ?? 0);
      const endMin = Math.min(startMin + 60, 22 * 60);
      const fmt = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      setHorarioInicio(fmt(startMin));
      setHorarioFim(fmt(endMin));
      setDiaSemana(String(prefill.date.getDay()));
      setDataEspecifica(format(prefill.date, "yyyy-MM-dd"));
    }
  }, [open, prefill, editEvent]);

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"]);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return profs || [];
    },
  });

  const { data: consultores = [] } = useQuery({
    queryKey: ["admin_consultores"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return profs || [];
    },
  });

  const debouncedAlunoSearch = useDebounce(alunoSearch, 250);
  const searchTermo = debouncedAlunoSearch.trim();
  const searchAtivo = searchTermo.length >= 2;

  const { data: alunos = [], isFetching: isSearchingAlunos } = useQuery({
    queryKey: ["alunos_agenda_picker", searchTermo],
    enabled: searchAtivo,
    queryFn: async () => {
      const like = `%${searchTermo.replace(/[%,]/g, " ")}%`;
      const [{ data: alunosData, error }, { data: stagesData }] = await Promise.all([
        supabase
          .from("alunos")
          .select("id, nome, status, current_pipeline_stage_id, responsavel_id, email")
          .eq("is_equipe", false)
          .or(`nome.ilike.${like},email.ilike.${like}`)
          .order("nome")
          .limit(50),
        supabase.from("pipeline_stages").select("id, name"),
      ]);
      if (error) throw error;
      const stageMap: Record<string, string> = {};
      (stagesData || []).forEach((s: any) => { stageMap[s.id] = s.name; });
      return (alunosData || [])
        .map((a: any) => {
          const stageName = a.current_pipeline_stage_id ? stageMap[a.current_pipeline_stage_id] : null;
          let tipo: "ativo" | "inativo" | "prospect" | "lead";
          if (stageName === LEAD_STAGE) tipo = "lead";
          else if (stageName && PROSPECT_STAGES.includes(stageName)) tipo = "prospect";
          else if (a.status === "encerrado" || a.status === "inativo") tipo = "inativo";
          else tipo = "ativo";
          return { ...a, tipo };
        })
        .filter((a: any) => a.tipo !== "lead");
    },
  });

  // Carrega separadamente o aluno selecionado para que o badge continue exibido
  // mesmo após limpar/alterar o termo de busca.
  const { data: selectedAlunoData } = useQuery({
    queryKey: ["aluno_agenda_selected", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome, status, current_pipeline_stage_id, responsavel_id")
        .eq("id", alunoId)
        .maybeSingle();
      return data as any;
    },
  });

  // Anamnese inicial do prospect (somente quando relevante)
  const showAnamnese = !!alunoId && ["Treino Experimental", "Avaliação Funcional"].includes(atividade);
  const { data: anamnese } = useQuery({
    queryKey: ["prospect_anamnese_agenda", alunoId],
    enabled: showAnamnese,
    queryFn: async () => {
      const { data } = await supabase
        .from("prospect_anamnese" as any)
        .select("limitacoes, atividade_fisica, objetivo_treinamento")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      return data as any;
    },
  });

  // Auto-preenche profissional ao selecionar prospect em Treino Experimental
  const [autoFilledProfFor, setAutoFilledProfFor] = useState<string>("");
  useEffect(() => {
    if (isEditing) return;
    if (atividade !== "Treino Experimental") return;
    if (!alunoId) return;
    const aluno = alunos.find((a: any) => a.id === alunoId);
    if (aluno?.responsavel_id && autoFilledProfFor !== alunoId) {
      setProfissionalId(aluno.responsavel_id);
      setAutoFilledProfFor(alunoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId, atividade, alunos, isEditing]);

  const { data: studentCredits } = useQuery({
    queryKey: ["student_credits", alunoId, atividade],
    enabled: !!alunoId && !!atividade && ATIVIDADES_COM_CREDITO.has(atividade),
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // 1) Créditos de serviço avulso (creditos_aluno)
      const { data } = await supabase
        .from("creditos_aluno")
        .select("quantidade_inicial, quantidade_usada, ilimitado, origem_tipo, data_validade")
        .eq("aluno_id", alunoId)
        .eq("atividade", atividade)
        .eq("ativo", true);

      const linhas = (data || []).filter(
        (c: any) => !c.data_validade || c.data_validade >= today,
      );

      const servicoLs = linhas.filter((c: any) => c.origem_tipo === "servico");
      const servico = servicoLs.length === 0
        ? { temLinhas: false, ilimitado: false, total: 0, usado: 0, restante: 0 }
        : (() => {
            const ilimitado = servicoLs.some((c: any) => c.ilimitado);
            const total = servicoLs.reduce((s: number, c: any) => s + (c.quantidade_inicial ?? 0), 0);
            const usado = servicoLs.reduce((s: number, c: any) => s + (c.quantidade_usada ?? 0), 0);
            return { temLinhas: true, ilimitado, total, usado, restante: ilimitado ? Infinity : total - usado };
          })();

      // 2) Créditos do plano (planos.servicos + consumo_servicos) — somente p/ atividades mapeadas
      const planLabel = PLAN_SERVICE_LABEL[atividade];
      let plano = { temLinhas: false, ilimitado: false, total: 0, usado: 0, restante: 0 };
      if (planLabel) {
        const { data: planoAtivo } = await queryPlanoPrincipalAtivo(alunoId, "id, servicos");

        if (planoAtivo) {
          const base = parsePlanServiceCount(planoAtivo.servicos as any, planLabel);
          const { data: consumos } = await supabase
            .from("consumo_servicos")
            .select("quantidade, agenda_id, tipo_registro, tipo_servico")
            .eq("aluno_id", alunoId)
            .eq("plano_id", planoAtivo.id)
            .eq("tipo_servico", planLabel);

          const comprado = (consumos || [])
            .filter((c: any) => c.tipo_registro === "compra")
            .reduce((s: number, c: any) => s + (c.quantidade ?? 1), 0);
          const usado = (consumos || [])
            .filter((c: any) => !!c.agenda_id || c.tipo_registro === "uso_manual").length;
          const total = base + comprado;
          if (total > 0 || usado > 0) {
            plano = { temLinhas: true, ilimitado: false, total, usado, restante: total - usado };
          }
        }
      }

      const temLinhas = plano.temLinhas || servico.temLinhas;
      const ilimitado = plano.ilimitado || servico.ilimitado;
      const total = plano.total + servico.total;
      const usado = plano.usado + servico.usado;
      const restante = ilimitado ? Infinity : total - usado;
      const origens = [
        plano.temLinhas ? "plano" : null,
        servico.temLinhas ? "servico" : null,
      ].filter(Boolean) as string[];

      return { total, usado, restante, ilimitado, origens, temLinhas, plano, servico };
    },
  });

  const planoTemSaldo = !!studentCredits?.plano.temLinhas && (studentCredits.plano.ilimitado || studentCredits.plano.restante > 0);
  const servicoTemSaldo = !!studentCredits?.servico.temLinhas && (studentCredits.servico.ilimitado || studentCredits.servico.restante > 0);
  const exigeEscolhaOrigem = planoTemSaldo && servicoTemSaldo;

  // Auto-seleção quando há apenas uma origem com saldo
  useEffect(() => {
    if (!studentCredits) { setCreditoOrigem(""); return; }
    if (exigeEscolhaOrigem) {
      // Mantém escolha do usuário; reseta só se virou inválida
      if (creditoOrigem !== "plano" && creditoOrigem !== "servico") setCreditoOrigem("");
    } else if (planoTemSaldo) {
      setCreditoOrigem("plano");
    } else if (servicoTemSaldo) {
      setCreditoOrigem("servico");
    } else {
      setCreditoOrigem("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentCredits, planoTemSaldo, servicoTemSaldo, exigeEscolhaOrigem]);


  const filteredAlunos = alunos;

  const selectedAluno = useMemo(() => {
    if (!alunoId) return undefined;
    return alunos.find((a: any) => a.id === alunoId) ?? selectedAlunoData ?? undefined;
  }, [alunos, alunoId, selectedAlunoData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const base: any = {
        atividade,
        local,
        tipo,
        profissional_id: profissionalId || (atividade === "Avaliação Funcional" ? null : user?.id),
        consultor_id: ["Treino Experimental", "Avaliação Funcional"].includes(atividade) ? (consultorId || null) : null,
        protocolo: atividade === "Avaliação Funcional" ? (protocolo || null) : null,
        observacoes: observacoes || null,
        visivel_portal: visivelPortal,
      };

      // Criação em lote de horários fixos (dias × horários)
      if (modoLote) {
        const dias = diasSemana.map((d) => parseInt(d));
        const combos = dias.flatMap((d) => horarios.map((h) => ({ dia: d, hora: h })));
        const unico = combos.length === 1;

        // Ignora duplicados já existentes na grade
        const { data: existentes } = await supabase
          .from("agenda_servicos")
          .select("dia_semana, horario_inicio")
          .eq("tipo", "fixo")
          .eq("atividade", atividade)
          .eq("local", local)
          .in("dia_semana", dias);
        const jaExiste = new Set(
          (existentes || []).map((e: any) => `${e.dia_semana}|${String(e.horario_inicio).slice(0, 5)}`)
        );

        const novos = combos.filter((c) => !jaExiste.has(`${c.dia}|${c.hora}`));
        const ignorados = combos.length - novos.length;
        if (novos.length === 0) {
          return { lote: true, criados: 0, ignorados };
        }

        const payloads = novos.map((c) => ({
          ...base,
          dia_semana: c.dia,
          horario_inicio: c.hora,
          horario_fim: somaUmaHora(c.hora),
          // Horário fixo é somente a vaga na grade — nunca leva aluno vinculado.
          aluno_id: null,
          credito_origem: null,
        }));

        const { data: inseridos, error } = await supabase
          .from("agenda_servicos")
          .insert(payloads)
          .select();
        if (error) throw error;

        if (unico) return (inseridos || [])[0];
        return { lote: true, criados: (inseridos || []).length, ignorados };
      }

      const editandoFixo = isEditing && editEvent?.tipo === "fixo";
      // Horário fixo é apenas a vaga na grade — nunca guarda aluno vinculado.
      const semAluno = editandoFixo || tipo === "fixo";

      const payload: any = {
        ...base,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dia_semana: tipo === "fixo" ? parseInt(diaSemana) : new Date(dataEspecifica + "T12:00:00").getDay(),
        aluno_id: semAluno ? null : (alunoId || null),
        credito_origem: (!semAluno && alunoId && ATIVIDADES_COM_CREDITO.has(atividade) && creditoOrigem) ? creditoOrigem : null,
      };
      if (tipo === "avulso") {
        payload.data_especifica = dataEspecifica;
      }

      if (isEditing) {
        const alunoAnterior = editEvent?.aluno_id ?? null;

        // Update existing event — em horário fixo o aluno nunca é gravado no modelo
        const { data: atualizado, error } = await supabase
          .from("agenda_servicos")
          .update(payload)
          .eq("id", editEvent.id)
          .select()
          .single();
        if (error) throw error;

        // Vincular aluno a uma vaga fixa cria uma RESERVA AVULSA na data clicada
        // e uma exceção no modelo, para a vaga não duplicar naquele dia.
        if (editandoFixo && alunoId && cellDateStr) {
          const { data: reserva, error: errReserva } = await supabase
            .from("agenda_servicos")
            .insert({
              ...base,
              tipo: "avulso",
              data_especifica: cellDateStr,
              dia_semana: new Date(cellDateStr + "T12:00:00").getDay(),
              horario_inicio: horarioInicio,
              horario_fim: horarioFim,
              aluno_id: alunoId,
              credito_origem: (alunoId && ATIVIDADES_COM_CREDITO.has(atividade) && creditoOrigem) ? creditoOrigem : null,
            })
            .select()
            .single();
          if (errReserva) throw errReserva;

          await supabase
            .from("agenda_servicos_excecoes")
            .insert({ agenda_id: editEvent.id, data_excecao: cellDateStr });

          return { ...reserva, __alunoAnterior: null };
        }

        return { ...(atualizado || {}), __alunoAnterior: alunoAnterior };
      } else {
        // Insert new event — débito de crédito é feito pelo trigger no banco
        const { data: inserted, error } = await supabase
          .from("agenda_servicos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return { ...inserted, __alunoAnterior: null };
      }

    },
    onSuccess: (inserted: any) => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["student_credits"] });
      queryClient.invalidateQueries({ queryKey: ["creditos-aluno", alunoId] });
      if (inserted?.lote) {
        const { criados, ignorados } = inserted;
        if (criados === 0) {
          toast.info("Nenhum horário criado — todos já existiam na grade.");
        } else {
          toast.success(
            `${criados} horário${criados > 1 ? "s" : ""} fixo${criados > 1 ? "s" : ""} criado${criados > 1 ? "s" : ""}` +
            (ignorados > 0 ? ` · ${ignorados} já existia${ignorados > 1 ? "m" : ""}` : "")
          );
        }
      } else {
        toast.success(isEditing ? "Horário atualizado com sucesso" : "Horário criado com sucesso");
      }

      // Novo agendamento (criação, reserva avulsa a partir de vaga fixa) OU
      // edição que passou a ter um aluno vinculado / trocou de aluno.
      const registroValido = !!inserted?.id && !inserted?.lote;
      const criouRegistro = registroValido && (!isEditing || inserted.id !== editEvent?.id);
      const alunoMudou =
        registroValido && !!inserted.aluno_id && inserted.aluno_id !== inserted.__alunoAnterior;
      const deveDisparar = criouRegistro || alunoMudou;

      // Fallback de notificação (idempotente via tabela agenda_notificacoes_log)
      if (deveDisparar && inserted.aluno_id &&
          ["Treino Experimental","Avaliação Funcional"].includes(inserted.atividade)) {
        supabase.functions.invoke("notify-agenda-evento", {
          body: { evento: "agendado", agenda_id: inserted.id, agenda: inserted, origem: "frontend" },
        }).catch((e) => console.error("notify-agenda-evento (insert):", e));
      }

      // Disparos automáticos WhatsApp
      if (deveDisparar) {
        console.log('[WhatsApp Disparo] Iniciando disparo para agenda:', inserted.id, 'atividade:', inserted.atividade);
        supabase.functions.invoke("whatsapp-disparo-agenda", {
          body: { evento: "agendamento_criado", agenda_id: inserted.id },
        }).then(({ error }) => {
          if (error) {
            console.error('[WhatsApp Disparo] Erro:', error);
            toast.warning("Agendamento salvo, mas o WhatsApp não foi enviado.");
          }
        }).catch((e) => {
          console.error('[WhatsApp Disparo] Erro:', e);
          toast.warning("Agendamento salvo, mas o WhatsApp não foi enviado.");
        });
      }

      // Se é avulso com profissional, oferecer notificação manual
      const podeNotificar = inserted?.id && !inserted?.lote &&
        inserted?.profissional_id &&
        (inserted?.data_especifica || inserted?.tipo === 'fixo');


      if (podeNotificar) {
        setAgendamentoSalvo(inserted);
        // Não fecha o dialog ainda — aguarda ação do usuário
      } else {
        resetForm();
        onOpenChange(false);
      }
    },
    onError: (e: any) => toast.error((isEditing ? "Erro ao atualizar: " : "Erro ao criar: ") + e.message),
  });

  const resetForm = () => {
    setAtividade("");
    setLocal("");
    setTipo("avulso");
    setDiaSemana("");
    setDiasSemana([]);
    setHorarios([]);
    setNovoHorario("16:30");
    setDataEspecifica("");
    setHorarioInicio("08:00");
    setHorarioFim("09:00");
    setProfissionalId("");
    setConsultorId("");
    setObservacoes("");
    setAlunoId("");
    setAlunoSearch("");
    setCreditoOrigem("");
    setProtocolo("");
    setVisivelPortal(false);
    setAgendamentoSalvo(null);
  };

  const notificarProfissional = async () => {
    if (!agendamentoSalvo) return;
    setNotificando(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-disparo-agenda", {
        body: {
          evento: "notificacao_manual",
          agenda_id: agendamentoSalvo.id,
          agenda_snapshot: agendamentoSalvo, // passa os dados completos para evitar re-busca
        },
      });
      if (error) throw error;
      toast.success("Profissional notificado via WhatsApp");
    } catch (e: any) {
      toast.error("Erro ao notificar: " + (e?.message ?? "desconhecido"));
    } finally {
      setNotificando(false);
      setAgendamentoSalvo(null);
      resetForm();
      onOpenChange(false);
    }
  };


  const fecharSemNotificar = () => {
    setAgendamentoSalvo(null);
    resetForm();
    onOpenChange(false);
  };

  const canSubmit = atividade && local &&
    (modoLote
      ? totalLote > 0
      : horarioInicio && horarioFim && (tipo === "fixo" ? diaSemana !== "" : dataEspecifica !== "")) &&
    (!exigeEscolhaOrigem || !!creditoOrigem);

  const hasCredits =
    !alunoId ||
    !ATIVIDADES_COM_CREDITO.has(atividade) ||
    !studentCredits ||
    !studentCredits.temLinhas ||
    studentCredits.ilimitado ||
    studentCredits.restante > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Horário" : "Novo Horário"}</DialogTitle>
          <DialogDescription>{isEditing ? "Edite os dados do horário." : "Preencha os dados do horário e vincule um aluno se necessário."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Atividade</Label>
            <Select
              value={atividade}
              onValueChange={(v) => {
                setAtividade(v);
                const padrao = ATIVIDADE_LOCAL_PADRAO[v];
                if (padrao) setLocal(padrao);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
              <SelectContent>
                {ATIVIDADES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Local</Label>
            <Select value={local} onValueChange={setLocal}>
              <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
              <SelectContent>
                {LOCAIS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Horário</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avulso">Avulso (data específica)</SelectItem>
                <SelectItem value="fixo">Fixo (semanal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modoLote ? (
            <>
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((d) => {
                    const ativo = diasSemana.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDia(d.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          ativo
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {d.label.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Horários</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={novoHorario}
                    onChange={(e) => setNovoHorario(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={adicionarHorario}>Adicionar</Button>
                </div>
                {horarios.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {horarios.map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs gap-1.5">
                        {h} → {somaUmaHora(h)}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setHorarios((prev) => prev.filter((x) => x !== h))}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Cada horário dura 1 hora (ex.: 16:30 → 17:30).</p>
                )}
                {totalLote > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {diasSemana.length} dia{diasSemana.length > 1 ? "s" : ""} × {horarios.length} horário{horarios.length > 1 ? "s" : ""} = {totalLote} horário{totalLote > 1 ? "s" : ""} fixo{totalLote > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {tipo === "fixo" ? (
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select value={diaSemana} onValueChange={setDiaSemana}>
                    <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={dataEspecifica} onChange={(e) => setDataEspecifica(e.target.value)} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Horário Início</Label>
                  <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Horário Fim</Label>
                  <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Student search */}
          <div className="space-y-2">
            <Label>Aluno (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={alunoBloqueado ? "Indisponível para horário fixo" : "Buscar aluno pelo nome..."}
                disabled={alunoBloqueado}
                value={selectedAluno ? selectedAluno.nome : alunoSearch}
                onChange={(e) => {
                  setAlunoSearch(e.target.value);
                  setAlunoId("");
                }}
                className="pl-9"
              />
            </div>
            {alunoBloqueado && (
              <p className="text-xs text-muted-foreground">
                Horários fixos são apenas vagas na grade. O aluno é sempre agendado de forma avulsa, em uma data específica.
              </p>
            )}
            {editandoFixoUI && cellDateStr && (
              <p className="text-xs text-muted-foreground">
                O aluno será agendado como avulso em {format(cellDate!, "dd/MM/yyyy")}, sem repetir nas próximas semanas.
              </p>
            )}
            {alunoId && selectedAluno && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedAluno.nome}
                </Badge>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => { setAlunoId(""); setAlunoSearch(""); }}
                >
                  Remover
                </button>
              </div>
            )}
            {!alunoId && searchAtivo && filteredAlunos.length > 0 && (
              <ScrollArea className="max-h-32 rounded-md border border-border bg-popover">
                {filteredAlunos.map((a: any) => (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
                    onClick={() => { setAlunoId(a.id); setAlunoSearch(""); }}
                  >
                    <span className="truncate">{a.nome}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        a.tipo === "ativo" ? "status-active"
                          : a.tipo === "prospect" ? "status-warning"
                          : "status-urgent"
                      }`}
                    >
                      {a.tipo === "ativo" ? "Ativo" : a.tipo === "prospect" ? "Prospect" : "Inativo"}
                    </Badge>
                  </button>
                ))}
              </ScrollArea>
            )}
            {!alunoId && alunoSearch.trim() && !searchAtivo && (
              <p className="text-xs text-muted-foreground">Digite ao menos 2 letras…</p>
            )}
            {!alunoId && searchAtivo && !isSearchingAlunos && filteredAlunos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum aluno encontrado</p>
            )}
            {!alunoId && searchAtivo && isSearchingAlunos && filteredAlunos.length === 0 && (
              <p className="text-xs text-muted-foreground">Buscando…</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Profissional</Label>
            <Select value={profissionalId} onValueChange={setProfissionalId}>
              <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
              <SelectContent>
                {profissionais.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {atividade === "Avaliação Funcional" && (
            <div className="space-y-2">
              <Label>Protocolo</Label>
              <Select value={protocolo} onValueChange={setProtocolo}>
                <SelectTrigger><SelectValue placeholder="Selecione o protocolo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Saúde">Saúde</SelectItem>
                  <SelectItem value="Corredores">Corredores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {["Treino Experimental", "Avaliação Funcional"].includes(atividade) && (
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o consultor" /></SelectTrigger>
                <SelectContent>
                  {consultores.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Anamnese inicial (prospect) */}
          {showAnamnese && alunoId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Anamnese inicial</p>
              {!anamnese ? (
                <p className="text-xs text-muted-foreground">Anamnese não preenchida.</p>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Limitações / patologias / dores / lesões</p>
                    <p className="text-foreground whitespace-pre-wrap">{anamnese.limitacoes || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Atividade física atual / tempo parado</p>
                    <p className="text-foreground whitespace-pre-wrap">{anamnese.atividade_fisica || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Objetivo com o treinamento funcional</p>
                    <p className="text-foreground whitespace-pre-wrap">{anamnese.objetivo_treinamento || "—"}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Credit info */}
          {alunoId && atividade && ATIVIDADES_COM_CREDITO.has(atividade) && studentCredits && (
            <div className={`rounded-lg border p-3 text-sm ${studentCredits.ilimitado || studentCredits.restante > 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {!studentCredits.ilimitado && studentCredits.restante <= 0 && studentCredits.temLinhas && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <span className="font-medium">{atividade}</span>
                {studentCredits.origens?.includes("plano") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Plano</Badge>
                )}
                {studentCredits.origens?.includes("servico") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Serviço</Badge>
                )}
              </div>
              {!studentCredits.temLinhas ? (
                <p className="text-muted-foreground">Aluno sem créditos contratados para esta atividade</p>
              ) : studentCredits.ilimitado ? (
                <div className="text-muted-foreground">Créditos ilimitados ∞</div>
              ) : (
                <div className="text-muted-foreground">
                  <span>Créditos: </span>
                  <span className="font-medium text-foreground">{studentCredits.usado}</span>
                  <span> de </span>
                  <span className="font-medium text-foreground">{studentCredits.total}</span>
                  <span> utilizados</span>
                  {studentCredits.restante > 0 ? (
                    <span className="text-primary ml-2">({studentCredits.restante} restante{studentCredits.restante > 1 ? "s" : ""})</span>
                  ) : (
                    <span className="text-destructive ml-2">(sem créditos)</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Seletor de origem do crédito quando há saldo em ambas as origens */}
          {alunoId && atividade && ATIVIDADES_COM_CREDITO.has(atividade) && exigeEscolhaOrigem && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm">Usar crédito de</Label>
              <RadioGroup value={creditoOrigem} onValueChange={(v) => setCreditoOrigem(v as any)} className="space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-md border bg-background/50 p-2 cursor-pointer hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="plano" id="origem-plano" />
                    <span className="text-sm font-medium">Plano contratado</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {studentCredits!.plano.ilimitado
                      ? "∞ ilimitado"
                      : `${studentCredits!.plano.restante} restante${studentCredits!.plano.restante > 1 ? "s" : ""}`}
                  </span>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border bg-background/50 p-2 cursor-pointer hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="servico" id="origem-servico" />
                    <span className="text-sm font-medium">Serviço avulso</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {studentCredits!.servico.ilimitado
                      ? "∞ ilimitado"
                      : `${studentCredits!.servico.restante} restante${studentCredits!.servico.restante > 1 ? "s" : ""}`}
                  </span>
                </label>
              </RadioGroup>
              {!creditoOrigem && (
                <p className="text-xs text-destructive">Selecione a origem do crédito para continuar.</p>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="visivel-portal" className="text-sm">Visível no app do aluno</Label>
              <p className="text-xs text-muted-foreground">
                Quando ligado, este horário aparece em Agenda &gt; Serviços no app do aluno.
              </p>
            </div>
            <Switch id="visivel-portal" checked={visivelPortal} onCheckedChange={setVisivelPortal} />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <DialogFooter>
          {agendamentoSalvo ? (
            <div className="flex flex-col gap-2 w-full">
              <p className="text-sm text-muted-foreground text-center">
                ✅ Agendamento salvo! Deseja notificar o profissional?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={fecharSemNotificar}>
                  Fechar sem notificar
                </Button>
                <Button onClick={notificarProfissional} disabled={notificando} className="gap-2">
                  {notificando ? <Loader2 className="w-4 h-4 animate-spin" /> : "📱"}
                  {notificando ? "Enviando..." : "Notificar via WhatsApp"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!canSubmit || mutation.isPending || (!!alunoId && !hasCredits)}
              >
                {mutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
