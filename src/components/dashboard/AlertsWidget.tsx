import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, UserX, FileWarning } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: "atencao" | "urgente";
  studentName: string;
  message: string;
}

export function AlertsWidget() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const result: Alert[] = [];

      // 1. Planos vencendo (próximos 30 dias)
      const { data: planos } = await supabase
        .from("planos")
        .select("id, aluno_id, tipo, data_inicio, duracao_meses")
        .eq("ativo", true);

      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, status");

      const alunoMap: Record<string, string> = {};
      (alunos || []).forEach((a) => { alunoMap[a.id] = a.nome; });

      const today = new Date();
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);

      (planos || []).forEach((p) => {
        const start = new Date(p.data_inicio + "T00:00:00");
        const end = new Date(start);
        end.setMonth(end.getMonth() + p.duracao_meses);

        if (end <= in30 && end >= today) {
          result.push({
            id: `plano-${p.id}`,
            type: "plano_vencendo",
            severity: end <= new Date(today.getTime() + 7 * 86400000) ? "urgente" : "atencao",
            studentName: alunoMap[p.aluno_id] || "Aluno",
            message: `Plano ${p.tipo} vence em ${end.toLocaleDateString("pt-BR")}`,
          });
        }
      });

      // 2. Alunos em licença
      (alunos || []).filter((a) => a.status === "licenca").forEach((a) => {
        result.push({
          id: `licenca-${a.id}`,
          type: "licenca",
          severity: "atencao",
          studentName: a.nome,
          message: "Aluno em licença",
        });
      });

      return result.sort((a, b) => (a.severity === "urgente" ? -1 : 1) - (b.severity === "urgente" ? -1 : 1));
    },
  });

  const iconMap: Record<string, React.ElementType> = {
    plano_vencendo: AlertTriangle,
    licenca: UserX,
    troca_ficha: FileWarning,
    avaliacao: Clock,
  };

  const severityClass: Record<string, string> = {
    atencao: "status-warning",
    urgente: "status-urgent",
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        Alertas Técnicos
      </h3>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta pendente 🎉</p>
        ) : alerts.map((alert) => {
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
      </div>
    </div>
  );
}
