import { type Student, getRemainingDays } from "@/lib/mock-data";
import { CalendarDays, Dumbbell, ClipboardCheck, Heart, Clock, AlertTriangle } from "lucide-react";

export function StudentSummary({ student }: { student: Student }) {
  const remaining = getRemainingDays(student.planStart, student.planDurationMonths);
  const needsAssessment = !student.lastAssessment;
  const needsWorkoutChange = !student.lastWorkoutChange;

  const cards = [
    { label: "Status", value: student.status === 'ativo' ? 'Ativo' : student.status === 'licenca' ? 'Licença' : 'Encerrado', icon: Heart, highlight: student.status !== 'ativo' },
    { label: "Plano Ativo", value: student.plan, icon: ClipboardCheck },
    { label: "Dias Restantes", value: remaining > 0 ? `${remaining} dias` : 'Vencido', icon: CalendarDays, highlight: remaining < 30 },
    { label: "Última Avaliação", value: student.lastAssessment || 'Nenhuma', icon: ClipboardCheck, highlight: needsAssessment },
    { label: "Última Troca Ficha", value: student.lastWorkoutChange || 'Nenhuma', icon: Dumbbell, highlight: needsWorkoutChange },
    { label: "Frequência", value: `${student.weeklyFrequency}x/semana`, icon: Clock },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`glass-card rounded-lg p-4 ${card.highlight ? 'border-warning/50' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.highlight ? 'text-warning' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-sm font-semibold ${card.highlight ? 'text-warning' : 'text-foreground'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {student.services.length > 0 && (
        <div className="glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Serviços Incluídos</h3>
          <div className="flex gap-2 flex-wrap">
            {student.services.map(s => (
              <span key={s} className="px-3 py-1 rounded-full text-xs bg-primary/15 text-primary border border-primary/30">{s}</span>
            ))}
          </div>
        </div>
      )}

      {(needsAssessment || needsWorkoutChange || remaining < 30) && (
        <div className="glass-card rounded-lg p-4 border-warning/50">
          <h3 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Pendências
          </h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {needsAssessment && <li>• Sem avaliação realizada</li>}
            {needsWorkoutChange && <li>• Sem troca de ficha registrada</li>}
            {remaining < 30 && remaining > 0 && <li>• Plano vencendo em {remaining} dias</li>}
            {remaining <= 0 && <li>• Plano vencido</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
