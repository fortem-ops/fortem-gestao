import { mockStudents, getBirthdaysToday, getBirthdaysMonth } from "@/lib/mock-data";
import { Cake } from "lucide-react";

export function BirthdaysWidget() {
  const today = getBirthdaysToday(mockStudents);
  const month = getBirthdaysMonth(mockStudents).filter(s => !today.includes(s));

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Cake className="w-4 h-4 text-primary" />
        Aniversariantes
      </h3>
      {today.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-primary mb-2">🎂 Hoje</p>
          {today.map(s => (
            <p key={s.id} className="text-sm text-foreground">{s.name}</p>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Este mês</p>
        {month.length > 0 ? month.map(s => {
          const bd = new Date(s.birthDate);
          return (
            <p key={s.id} className="text-sm text-foreground">
              {s.name} <span className="text-muted-foreground">· {bd.getDate()}/{bd.getMonth() + 1}</span>
            </p>
          );
        }) : (
          <p className="text-sm text-muted-foreground">Nenhum aniversariante</p>
        )}
      </div>
    </div>
  );
}
