import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanAlert {
  alunoId: string;
  alunoNome: string;
  planoTipo: string;
  dataFinal: Date;
}

export function AdminAlertsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["admin-alerts-planos", user?.id],
    queryFn: async () => {
      const { data: isCoord } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });

      // Get active plans
      const { data: planos } = await supabase
        .from("planos")
        .select("id, aluno_id, tipo, data_inicio, duracao_meses")
        .eq("ativo", true);

      if (!planos?.length) return { esteMes: [], proximoMes: [] };

      const alunoIds = [...new Set(planos.map((p) => p.aluno_id))];

      // Get students + filter by professor if not coord/admin
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, responsavel_id")
        .in("id", alunoIds);

      const alunoMap: Record<string, { nome: string; responsavel_id: string | null }> = {};
      (alunos || []).forEach((a) => {
        alunoMap[a.id] = { nome: a.nome, responsavel_id: a.responsavel_id };
      });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

      const esteMes: PlanAlert[] = [];
      const proximoMes: PlanAlert[] = [];

      planos.forEach((p) => {
        const aluno = alunoMap[p.aluno_id];
        if (!aluno) return;

        // If professor, only show their own students
        if (!isCoord && aluno.responsavel_id !== user!.id) return;

        const start = new Date(p.data_inicio + "T00:00:00");
        const end = new Date(start);
        end.setMonth(end.getMonth() + p.duracao_meses);

        const endMonth = end.getMonth();
        const endYear = end.getFullYear();

        const alert: PlanAlert = {
          alunoId: p.aluno_id,
          alunoNome: aluno.nome,
          planoTipo: p.tipo,
          dataFinal: end,
        };

        if (endYear === currentYear && endMonth === currentMonth) {
          esteMes.push(alert);
        } else if (endYear === nextYear && endMonth === nextMonth) {
          proximoMes.push(alert);
        }
      });

      esteMes.sort((a, b) => a.dataFinal.getTime() - b.dataFinal.getTime());
      proximoMes.sort((a, b) => a.dataFinal.getTime() - b.dataFinal.getTime());

      return { esteMes, proximoMes };
    },
    enabled: !!user,
  });

  const esteMes = data?.esteMes || [];
  const proximoMes = data?.proximoMes || [];
  const total = esteMes.length + proximoMes.length;

  const now = new Date();
  const mesAtualLabel = now.toLocaleDateString("pt-BR", { month: "long" });
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const proximoMesLabel = nextDate.toLocaleDateString("pt-BR", { month: "long" });

  const renderAlerts = (alerts: PlanAlert[]) => {
    if (alerts.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-3">Nenhum vencimento</p>;
    }
    return alerts.map((a) => {
      const isPast = a.dataFinal < now;
      return (
        <div key={`${a.alunoId}-${a.dataFinal.toISOString()}`} className="flex items-center justify-between p-2.5 rounded-md bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => navigate(`/alunos/${a.alunoId}`)}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{a.alunoNome}</p>
            <p className="text-xs text-muted-foreground">
              {a.planoTipo} • {a.dataFinal.toLocaleDateString("pt-BR")}
            </p>
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ${isPast ? "status-urgent" : "status-warning"}`}>
            {isPast ? "Vencido" : "Vence"}
          </Badge>
        </div>
      );
    });
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-warning" />
        Alerta Administrativo
        {total > 0 && <Badge variant="destructive" className="ml-auto">{total}</Badge>}
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            {mesAtualLabel} (mês atual)
          </p>
          <div className="space-y-2">{renderAlerts(esteMes)}</div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            {proximoMesLabel} (próximo mês)
          </p>
          <div className="space-y-2">{renderAlerts(proximoMes)}</div>
        </div>
      </div>
    </div>
  );
}
