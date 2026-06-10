import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import StudentFormFields, { type StudentFormValues, getPlanDetails } from "./StudentFormFields";
import { isAutoRenewPlan } from "@/lib/planTipo";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import type { Tables } from "@/integrations/supabase/types";

interface EditStudentDialogProps {
  student: Tables<"alunos">;
  onStudentUpdated: () => void;
}

export default function EditStudentDialog({ student, onStudentUpdated }: EditStudentDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planDefaults, setPlanDefaults] = useState<{
    plano?: string; plano_consultas?: string;
    plano_valor?: number; plano_data_inicio?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    supabase
      .from("planos")
      .select("tipo, servicos, valor, data_inicio")
      .eq("aluno_id", student.id)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const p = data[0];
          let consultas: string | undefined;
          const servicos = p.servicos || [];
          if (p.tipo === "Power") {
            consultas = servicos.some((s: string) => s.includes("Reabilitação")) ? "reabilitacao" : "nutricao";
          } else if (p.tipo === "Pro") {
            if (servicos.some((s: string) => s.includes("Reabilitação")) && servicos.some((s: string) => s.includes("Nutrição")))
              consultas = "misto";
            else if (servicos.some((s: string) => s.includes("Reabilitação")))
              consultas = "reabilitacao";
            else consultas = "nutricao";
          }
          const tipoSelecao = p.tipo?.startsWith("VIP") ? "VIP" : p.tipo;
          setPlanDefaults({
            plano: tipoSelecao,
            plano_consultas: consultas,
            plano_valor: p.valor ?? undefined,
            plano_data_inicio: p.data_inicio,
          });
        } else {
          setPlanDefaults({});
        }
      });
  }, [open, student.id]);

  const defaultValues: StudentFormValues = {
    nome: student.nome,
    email: student.email || "",
    telefone: student.telefone || "",
    data_nascimento: student.data_nascimento || "",
    status: (student.status as "ativo" | "licenca" | "encerrado") || "ativo",
    frequencia_semanal: student.frequencia_semanal || 3,
    observacoes: student.observacoes || "",
    plano: planDefaults.plano as any,
    plano_consultas: planDefaults.plano_consultas,
    plano_valor: planDefaults.plano_valor,
    plano_data_inicio: planDefaults.plano_data_inicio,
    professor_responsavel_id: student.responsavel_id || undefined,
  };

  async function onSubmit(values: StudentFormValues) {
    setLoading(true);
    try {
      const responsavelId = values.professor_responsavel_id || student.responsavel_id;

      const { error } = await supabase.from("alunos").update({
        nome: values.nome,
        email: values.email || null,
        telefone: values.telefone || null,
        data_nascimento: values.data_nascimento || null,
        status: values.status,
        frequencia_semanal: values.frequencia_semanal,
        observacoes: values.observacoes || null,
        responsavel_id: responsavelId,
      }).eq("id", student.id);
      if (error) throw error;

      const plan = getPlanDetails(values.plano, values.plano_consultas);
      if (plan) {
        await supabase.from("planos").update({ ativo: false }).eq("aluno_id", student.id).eq("ativo", true);
        const dataInicio = values.plano_data_inicio || new Date().toISOString().split("T")[0];
        let tipoFinal = plan.tipo;
        if (plan.tipo === "VIP") {
          const freq = values.frequencia_semanal;
          const sufixo = freq === 0 ? "Livre" : `${freq}x/semana`;
          tipoFinal = `VIP ${sufixo}`;
        }
        await supabase.from("planos").insert({
          aluno_id: student.id,
          tipo: tipoFinal,
          data_inicio: dataInicio,
          duracao_meses: plan.duracao_meses,
          servicos: plan.servicos,
          valor: values.plano_valor || 0,
          ativo: true,
          renovacao_automatica: isAutoRenewPlan(tipoFinal) || undefined,
        });
      }

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
          key={student.id + student.updated_at + JSON.stringify(planDefaults)}
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
