import type { Tables } from "@/integrations/supabase/types";
import { CalendarDays, Dumbbell, ClipboardCheck, Heart, Clock, AlertTriangle } from "lucide-react";

type Aluno = Tables<"alunos">;

export function StudentSummary({ student }: { student: Aluno }) {
  const statusMap: Record<string, string> = { ativo: "Ativo", licenca: "Licença", encerrado: "Encerrado" };

  const cards = [
    { label: "Status", value: statusMap[student.status] || student.status, icon: Heart, highlight: student.status !== "ativo" },
    { label: "Frequência", value: `${student.frequencia_semanal || 0}x/semana`, icon: Clock },
    { label: "Email", value: student.email || "Não informado", icon: ClipboardCheck },
    { label: "Telefone", value: student.telefone || "Não informado", icon: CalendarDays },
    { label: "Data Nascimento", value: student.data_nascimento ? new Date(student.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "Não informada", icon: CalendarDays },
    { label: "Cadastro", value: new Date(student.created_at).toLocaleDateString("pt-BR"), icon: Dumbbell },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`glass-card rounded-lg p-4 ${card.highlight ? "border-warning/50" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.highlight ? "text-warning" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-sm font-semibold ${card.highlight ? "text-warning" : "text-foreground"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {student.observacoes && (
        <div className="glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Observações</h3>
          <p className="text-sm text-muted-foreground">{student.observacoes}</p>
        </div>
      )}
    </div>
  );
}
