import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import type { Tables } from "@/integrations/supabase/types";

interface EditStudentDialogProps {
  student: Tables<"alunos">;
  onStudentUpdated: () => void;
}

const NONE = "__none__";

export default function EditStudentDialog({ student, onStudentUpdated }: EditStudentDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [professors, setProfessors] = useState<{ user_id: string; full_name: string }[]>([]);

  const [frequencia, setFrequencia] = useState(String(student.frequencia_semanal || 3));
  const [professorId, setProfessorId] = useState(student.responsavel_id || NONE);
  const [consultorId, setConsultorId] = useState((student as any).consultor_id || NONE);
  const [observacoes, setObservacoes] = useState(student.observacoes || "");

  useEffect(() => {
    if (!open) return;
    setFrequencia(String(student.frequencia_semanal || 3));
    setProfessorId(student.responsavel_id || NONE);
    setConsultorId((student as any).consultor_id || NONE);
    setObservacoes(student.observacoes || "");
  }, [open, student]);

  useEffect(() => {
    async function loadProfessors() {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles || roles.length === 0) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      if (profiles) setProfessors(profiles as any);
    }
    loadProfessors();
  }, []);

  async function handleSave() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("alunos")
        .update({
          frequencia_semanal: Number(frequencia),
          responsavel_id: professorId === NONE ? null : professorId,
          consultor_id: consultorId === NONE ? null : consultorId,
          observacoes: observacoes.trim() || null,
        })
        .eq("id", student.id);
      if (error) throw error;

      toast.success("Aluno atualizado com sucesso!");
      invalidatePlanoCaches(queryClient, student.id);
      setOpen(false);
      onStudentUpdated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar aluno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="w-4 h-4" />Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Aluno</DialogTitle>
          <DialogDescription>
            Dados cadastrais são editados em "Editar dados cadastrais". Planos seguem o fluxo de contratação/cancelamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Frequência Semanal</Label>
            <Select value={frequencia} onValueChange={setFrequencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x por semana</SelectItem>
                <SelectItem value="2">2x por semana</SelectItem>
                <SelectItem value="3">3x por semana</SelectItem>
                <SelectItem value="4">4x por semana</SelectItem>
                <SelectItem value="5">Livre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Professor Responsável</Label>
            <Select value={professorId} onValueChange={setProfessorId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem professor</SelectItem>
                {professors.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Consultor Responsável</Label>
            <Select value={consultorId} onValueChange={setConsultorId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem consultor</SelectItem>
                {professors.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              maxLength={1000}
              placeholder="Observações sobre o aluno..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
