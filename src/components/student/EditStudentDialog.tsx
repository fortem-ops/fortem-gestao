import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import StudentFormFields, { type StudentFormValues } from "./StudentFormFields";
import type { Tables } from "@/integrations/supabase/types";

interface EditStudentDialogProps {
  student: Tables<"alunos">;
  onStudentUpdated: () => void;
}

export default function EditStudentDialog({ student, onStudentUpdated }: EditStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultValues: StudentFormValues = {
    nome: student.nome,
    email: student.email || "",
    telefone: student.telefone || "",
    data_nascimento: student.data_nascimento || "",
    status: (student.status as "ativo" | "licenca" | "encerrado") || "ativo",
    frequencia_semanal: student.frequencia_semanal || 3,
    observacoes: student.observacoes || "",
  };

  async function onSubmit(values: StudentFormValues) {
    setLoading(true);
    try {
      const { error } = await supabase.from("alunos").update({
        nome: values.nome,
        email: values.email || null,
        telefone: values.telefone || null,
        data_nascimento: values.data_nascimento || null,
        status: values.status,
        frequencia_semanal: values.frequencia_semanal,
        observacoes: values.observacoes || null,
      }).eq("id", student.id);
      if (error) throw error;

      toast.success("Aluno atualizado com sucesso!");
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
        <DialogHeader><DialogTitle>Editar Aluno</DialogTitle></DialogHeader>
        <StudentFormFields
          key={student.id + student.updated_at}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel="Salvar Alterações"
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
