import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgendaDialog({ open, onOpenChange }: Props) {
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
      };
      if (tipo === "avulso") {
        payload.data_especifica = dataEspecifica;
      }
      const { error } = await supabase.from("agenda_servicos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      toast.success("Horário criado com sucesso");
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro ao criar horário: " + e.message),
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
  };

  const canSubmit = atividade && local && horarioInicio && horarioFim &&
    (tipo === "fixo" ? diaSemana !== "" : dataEspecifica !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Horário</DialogTitle>
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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
