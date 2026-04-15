import { StatsCards } from "@/components/dashboard/StatsCards";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { AdminAlertsWidget } from "@/components/dashboard/AdminAlertsWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { BirthdaysWidget } from "@/components/dashboard/BirthdaysWidget";
import { CarteiraWidget } from "@/components/dashboard/CarteiraWidget";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da equipe técnica</p>
      </div>

      <StatsCards />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AlertsWidget />
          <TasksWidget />
        </div>
        <div className="space-y-6">
          <AdminAlertsWidget />
          <CarteiraWidget />
          <BirthdaysWidget />
        </div>
      </div>
    </div>
  );
}
