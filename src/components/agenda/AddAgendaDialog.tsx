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
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const ATIVIDADES = [
  "Nutrição",
  "Reabilitação",
  "Avaliação Funcional",
  "Avaliação Física",
  "Recovery (Bota de Compressão)",
];

const LOCAIS = ["Sala de Nutrição", "Sala de Reabilitação"];

const DIAS_SEMANA = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const ATIVIDADE_TO_SERVICO: Record<string, string> = {
  "Nutrição": "Consultas Nutrição",
  "Reabilitação": "Consultas Reabilitação",
  "Avaliação Funcional": "Avaliação Funcional",
  "Avaliação Física": "Avaliação Física",
};

function parseServiceCredits(servicos: string[] | null, tipoServico: string): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
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
  const [tipo, setTipo] = useState("fixo");
  const [diaSemana, setDiaSemana] = useState("");
  const [dataEspecifica, setDataEspecifica] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("09:00");
  const [profissionalId, setProfissionalId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [alunoSearch, setAlunoSearch] = useState("");

  const isEditing = !!editEvent;

  // Apply prefill or editEvent when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setAtividade(editEvent.atividade || "");
      setLocal(editEvent.local || "");
      setTipo(editEvent.tipo || "fixo");
      setDiaSemana(String(editEvent.dia_semana ?? ""));
      setDataEspecifica(editEvent.data_especifica || "");
      setHorarioInicio(editEvent.horario_inicio?.slice(0, 5) || "08:00");
      setHorarioFim(editEvent.horario_fim?.slice(0, 5) || "09:00");
      setProfissionalId(editEvent.profissional_id || "");
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

  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, status")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: studentCredits } = useQuery({
    queryKey: ["student_credits", alunoId, atividade],
    enabled: !!alunoId && !!atividade && !!ATIVIDADE_TO_SERVICO[atividade],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos")
        .select("*")
        .eq("aluno_id", alunoId)
        .eq("ativo", true)
        .limit(1);

      if (!planos || planos.length === 0) return { plano: null, total: 0, usado: 0, restante: 0, comprado: 0, base: 0 };

      const plano = planos[0];
      const tipoServico = ATIVIDADE_TO_SERVICO[atividade];
      const base = parseServiceCredits(plano.servicos, tipoServico);

      const { data: consumos } = await supabase
        .from("consumo_servicos")
        .select("agenda_id, quantidade")
        .eq("aluno_id", alunoId)
        .eq("plano_id", plano.id)
        .eq("tipo_servico", tipoServico);

      // Purchased = records without agenda_id (extra credits bought)
      const comprado = consumos?.filter((c) => !c.agenda_id).reduce((sum, c) => sum + (c.quantidade ?? 1), 0) || 0;
      // Used = records with agenda_id (scheduled/consumed)
      const usado = consumos?.filter((c) => !!c.agenda_id).length || 0;
      const total = base + comprado;

      return { plano, total, usado, restante: total - usado, comprado, base };
    },
  });

  const filteredAlunos = useMemo(() => {
    if (!alunoSearch.trim()) return alunos;
    const search = alunoSearch.toLowerCase();
    return alunos.filter((a: any) => a.nome.toLowerCase().includes(search));
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
        observacoes: observacoes || null,
        dia_semana: tipo === "fixo" ? parseInt(diaSemana) : new Date(dataEspecifica + "T12:00:00").getDay(),
        aluno_id: alunoId || null,
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
        // Insert new event
        const { data: agendaData, error } = await supabase
          .from("agenda_servicos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        // Register consumption for new events only
        const tipoServico = ATIVIDADE_TO_SERVICO[atividade];
        if (alunoId && tipoServico && studentCredits?.plano) {
          const { error: consumoError } = await supabase
            .from("consumo_servicos")
            .insert({
              aluno_id: alunoId,
              plano_id: studentCredits.plano.id,
              agenda_id: agendaData.id,
              tipo_servico: tipoServico,
              data_consumo: tipo === "avulso" ? dataEspecifica : new Date().toISOString().split("T")[0],
              registrado_por: user?.id,
            });
          if (consumoError) throw consumoError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["student_credits"] });
      toast.success(isEditing ? "Horário atualizado com sucesso" : "Horário criado com sucesso");
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error((isEditing ? "Erro ao atualizar: " : "Erro ao criar: ") + e.message),
  });

  const resetForm = () => {
    setAtividade("");
    setLocal("");
    setTipo("fixo");
    setDiaSemana("");
    setDataEspecifica("");
    setHorarioInicio("08:00");
    setHorarioFim("09:00");
    setProfissionalId("");
    setObservacoes("");
    setAlunoId("");
    setAlunoSearch("");
  };

  const canSubmit = atividade && local && horarioInicio && horarioFim &&
    (tipo === "fixo" ? diaSemana !== "" : dataEspecifica !== "");

  const hasCredits = !alunoId || !ATIVIDADE_TO_SERVICO[atividade] || !studentCredits || studentCredits.restante > 0;

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
                <SelectItem value="fixo">Fixo (semanal)</SelectItem>
                <SelectItem value="avulso">Avulso (data específica)</SelectItem>
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => { setAlunoId(a.id); setAlunoSearch(""); }}
                  >
                    {a.nome}
                  </button>
                ))}
              </ScrollArea>
            )}
            {!alunoId && alunoSearch.trim() && filteredAlunos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum aluno encontrado</p>
            )}
          </div>

          {/* Credit info */}
          {alunoId && atividade && ATIVIDADE_TO_SERVICO[atividade] && studentCredits && (
            <div className={`rounded-lg border p-3 text-sm ${studentCredits.restante > 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 mb-1">
                {studentCredits.restante <= 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span className="font-medium">
                  {ATIVIDADE_TO_SERVICO[atividade]}
                </span>
              </div>
              {studentCredits.plano ? (
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
              ) : (
                <p className="text-muted-foreground">Aluno sem plano ativo</p>
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
