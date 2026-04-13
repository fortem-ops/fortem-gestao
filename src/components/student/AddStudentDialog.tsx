import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import StudentFormFields, { type StudentFormValues, getPlanDetails } from "./StudentFormFields";

interface AddStudentDialogProps {
  onStudentAdded: () => void;
}

export default function AddStudentDialog({ onStudentAdded }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const defaultValues: StudentFormValues = {
    nome: "", email: "", telefone: "", data_nascimento: "",
    status: "ativo", frequencia_semanal: 3, observacoes: "",
    plano: undefined, plano_consultas: undefined,
    plano_valor: undefined, plano_data_inicio: today,
    professor_responsavel_id: undefined,
  };

  async function onSubmit(values: StudentFormValues) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado."); return; }

      const responsavelId = values.professor_responsavel_id || user.id;

      const { data: aluno, error } = await supabase.from("alunos").insert({
        nome: values.nome,
        email: values.email || null,
        telefone: values.telefone || null,
        data_nascimento: values.data_nascimento || null,
        status: values.status,
        frequencia_semanal: values.frequencia_semanal,
        observacoes: values.observacoes || null,
        responsavel_id: responsavelId,
      }).select("id").single();
      if (error) throw error;

      const plan = getPlanDetails(values.plano, values.plano_consultas);
      if (plan && aluno) {
        const dataInicio = values.plano_data_inicio || today;
        const { error: planError } = await supabase.from("planos").insert({
          aluno_id: aluno.id,
          tipo: plan.tipo,
          data_inicio: dataInicio,
          duracao_meses: plan.duracao_meses,
          servicos: plan.servicos,
          valor: values.plano_valor || 0,
          ativo: true,
        });
        if (planError) console.error("Erro ao criar plano:", planError);
      }

      toast.success("Aluno cadastrado com sucesso!");
      setOpen(false);
      onStudentAdded();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar aluno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />Novo Aluno</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar Novo Aluno</DialogTitle></DialogHeader>
        <StudentFormFields
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel="Cadastrar"
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
