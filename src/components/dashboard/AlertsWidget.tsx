import { mockAlerts } from "@/lib/mock-data";
import { AlertTriangle, Clock, UserX, FileWarning } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  troca_ficha: FileWarning,
  avaliacao: Clock,
  licenca: UserX,
  plano_vencendo: AlertTriangle,
};

const severityClass: Record<string, string> = {
  ok: "status-active",
  atencao: "status-warning",
  urgente: "status-urgent",
};

export function AlertsWidget() {
  const alerts = mockAlerts.filter(a => a.severity !== 'ok');

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        Alertas Técnicos
      </h3>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.type] || AlertTriangle;
          return (
            <div key={alert.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
              <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${severityClass[alert.severity]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{alert.studentName}</p>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta pendente 🎉</p>
        )}
      </div>
    </div>
  );
}
