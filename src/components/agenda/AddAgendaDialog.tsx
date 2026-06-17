import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle } from "lucide-react";
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
  prefill?: { date: Date; hour: number } | null;
  editEvent?: any | null;
}

export function AddAgendaDialog({ open, onOpenChange, prefill, editEvent }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [atividade, setAtividade] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("avulso");
  const [diaSemana, setDiaSemana] = useState("");
  const [dataEspecifica, setDataEspecifica] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("09:00");
  const [profissionalId, setProfissionalId] = useState("");
  const [consultorId, setConsultorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [alunoSearch, setAlunoSearch] = useState("");
  const [creditoOrigem, setCreditoOrigem] = useState<"" | "plano" | "servico">("");

  const isEditing = !!editEvent;

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
    } else if (prefill) {
      const h = String(prefill.hour).padStart(2, "0");
      const hEnd = String(Math.min(prefill.hour + 1, 21)).padStart(2, "0");
      setHorarioInicio(`${h}:00`);
      setHorarioFim(`${hEnd}:00`);
      setDiaSemana(String(prefill.date.getDay()));
      setDataEspecifica(format(prefill.date, "yyyy-MM-dd"));
    }
  }, [open, prefill, editEvent]);

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
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

  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos_agenda_picker"],
    queryFn: async () => {
      const [{ data: alunosData, error }, { data: stagesData }] = await Promise.all([
        supabase.from("alunos").select("id, nome, status, current_pipeline_stage_id, responsavel_id").order("nome"),
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
        const { data: planoAtivo } = await supabase
          .from("planos")
          .select("id, servicos")
          .eq("aluno_id", alunoId)
          .eq("ativo", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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


  const filteredAlunos = useMemo(() => {
    if (!alunoSearch.trim()) return alunos;
    const search = alunoSearch.toLowerCase();
    return alunos.filter((a: any) => (a.nome ?? "").toLowerCase().includes(search));
  }, [alunos, alunoSearch]);

  const selectedAluno = useMemo(() => alunos.find((a: any) => a.id === alunoId), [alunos, alunoId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        atividade,
        local,
        tipo,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        profissional_id: profissionalId || user?.id,
        consultor_id: atividade === "Treino Experimental" ? (consultorId || null) : null,
        observacoes: observacoes || null,
        dia_semana: tipo === "fixo" ? parseInt(diaSemana) : new Date(dataEspecifica + "T12:00:00").getDay(),
        aluno_id: alunoId || null,
        credito_origem: (alunoId && ATIVIDADES_COM_CREDITO.has(atividade) && creditoOrigem) ? creditoOrigem : null,
      };
      if (tipo === "avulso") {
        payload.data_especifica = dataEspecifica;
      }

      if (isEditing) {
        // Update existing event
        const { error } = await supabase
          .from("agenda_servicos")
          .update(payload)
          .eq("id", editEvent.id);
        if (error) throw error;
      } else {
        // Insert new event — débito de crédito é feito pelo trigger no banco
        const { data: inserted, error } = await supabase
          .from("agenda_servicos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return inserted;
      }
    },
    onSuccess: (inserted: any) => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["student_credits"] });
      queryClient.invalidateQueries({ queryKey: ["creditos-aluno", alunoId] });
      toast.success(isEditing ? "Horário atualizado com sucesso" : "Horário criado com sucesso");

      // Fallback de notificação (idempotente via tabela agenda_notificacoes_log)
      if (!isEditing && inserted?.id && inserted.aluno_id &&
          ["Treino Experimental","Avaliação Funcional"].includes(inserted.atividade)) {
        supabase.functions.invoke("notify-agenda-evento", {
          body: { evento: "agendado", agenda_id: inserted.id, agenda: inserted, origem: "frontend" },
        }).catch((e) => console.error("notify-agenda-evento (insert):", e));
      }

      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error((isEditing ? "Erro ao atualizar: " : "Erro ao criar: ") + e.message),
  });

  const resetForm = () => {
    setAtividade("");
    setLocal("");
    setTipo("avulso");
    setDiaSemana("");
    setDataEspecifica("");
    setHorarioInicio("08:00");
    setHorarioFim("09:00");
    setProfissionalId("");
    setConsultorId("");
    setObservacoes("");
    setAlunoId("");
    setAlunoSearch("");
    setCreditoOrigem("");
  };

  const canSubmit = atividade && local && horarioInicio && horarioFim &&
    (tipo === "fixo" ? diaSemana !== "" : dataEspecifica !== "") &&
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
            <Select value={atividade} onValueChange={setAtividade}>
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

          {/* Student search */}
          <div className="space-y-2">
            <Label>Aluno (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno pelo nome..."
                value={selectedAluno ? selectedAluno.nome : alunoSearch}
                onChange={(e) => {
                  setAlunoSearch(e.target.value);
                  setAlunoId("");
                }}
                className="pl-9"
              />
            </div>
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
            {!alunoId && alunoSearch.trim() && filteredAlunos.length > 0 && (
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
            {!alunoId && alunoSearch.trim() && filteredAlunos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum aluno encontrado</p>
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

          {atividade === "Treino Experimental" && (
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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending || (!!alunoId && !hasCredits)}
          >
            {mutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
