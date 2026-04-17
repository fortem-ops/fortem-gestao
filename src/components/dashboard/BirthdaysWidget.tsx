import { Cake } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";

interface Props {
  professorId: string | null;
}

export function BirthdaysWidget({ professorId }: Props) {
  // Reuses consolidated dashboard RPC (cached 60s) — no extra query.
  const { data: dashboardData } = useDashboardData(professorId);
  const todayList = dashboardData?.aniversariantes?.today || [];
  const monthList = dashboardData?.aniversariantes?.month || [];

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Cake className="w-4 h-4 text-primary" />
        Aniversariantes
      </h3>
      {todayList.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-primary mb-2">🎂 Hoje</p>
          {todayList.map((s) => (
            <p key={s.id} className="text-sm text-foreground">{s.nome}</p>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Este mês</p>
        {monthList.length > 0 ? monthList.map((s) => (
          <p key={s.id} className="text-sm text-foreground">
            {s.nome} <span className="text-muted-foreground">· {s.dia}/{new Date().getMonth() + 1}</span>
          </p>
        )) : (
          <p className="text-sm text-muted-foreground">Nenhum aniversariante</p>
        )}
      </div>
    </div>
  );
}
