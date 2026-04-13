import { type Student, getRemainingDays } from "@/lib/mock-data";

export function StudentPlan({ student }: { student: Student }) {
  const remaining = getRemainingDays(student.planStart, student.planDurationMonths);

  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
      <div className="glass-card rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Tipo de Plano</span>
            <p className="text-sm font-semibold text-foreground mt-1">{student.plan}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Data Início</span>
            <p className="text-sm text-foreground mt-1">{student.planStart}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Duração</span>
            <p className="text-sm text-foreground mt-1">{student.planDurationMonths} meses</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Dias Restantes</span>
            <p className={`text-sm font-semibold mt-1 ${remaining < 30 ? 'text-destructive' : 'text-foreground'}`}>
              {remaining > 0 ? `${remaining} dias` : 'Vencido'}
            </p>
          </div>
        </div>
        {student.services.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Serviços Incluídos</span>
            <div className="flex gap-2 mt-2 flex-wrap">
              {student.services.map(s => (
                <span key={s} className="px-3 py-1 rounded-full text-xs bg-primary/15 text-primary border border-primary/30">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Editável apenas por Coordenação e Administração</p>
    </div>
  );
}
