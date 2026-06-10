import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface PlanAlert {
  alunoId: string;
  alunoNome: string;
  planoTipo: string;
  dataFinal: Date;
}

interface ProfessorAlerts {
  professorId: string;
  professorName: string;
  mesAnterior: PlanAlert[];
  esteMes: PlanAlert[];
  proximoMes: PlanAlert[];
}

const RECURRING_PLANS = ["Start", "Gympass/Wellhub", "Total Pass"];

export function AdminAlertsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["admin-alerts-planos", user?.id],
    queryFn: async () => {
      const { data: isCoord } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });

      const { data: planos } = await supabase
        .from("planos")
        .select("id, aluno_id, tipo, data_inicio, duracao_meses")
        .eq("ativo", true);

      if (!planos?.length) return [];

      const alunoIds = [...new Set(planos.map((p) => p.aluno_id))];

      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, responsavel_id")
        .in("id", alunoIds);

      const alunoMap: Record<string, { nome: string; responsavel_id: string | null }> = {};
      (alunos || []).forEach((a) => {
        alunoMap[a.id] = { nome: a.nome, responsavel_id: a.responsavel_id };
      });

      // Get professor names
      const profIds = [...new Set((alunos || []).map((a) => a.responsavel_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", profIds);
      const profNameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { profNameMap[p.user_id] = p.full_name; });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

      // Group by professor
      const grouped: Record<string, { mesAnterior: PlanAlert[]; esteMes: PlanAlert[]; proximoMes: PlanAlert[] }> = {};

      const ensureProf = (profId: string) => {
        if (!grouped[profId]) grouped[profId] = { mesAnterior: [], esteMes: [], proximoMes: [] };
      };

      planos.filter((p) => !RECURRING_PLANS.includes(p.tipo) && !(p.tipo || "").toLowerCase().startsWith("vip")).forEach((p) => {
        const aluno = alunoMap[p.aluno_id];
        if (!aluno) return;

        // If professor, only show their own students
        if (!isCoord && aluno.responsavel_id !== user!.id) return;

        const profId = aluno.responsavel_id || "sem-professor";
        ensureProf(profId);

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

        if (endYear === prevYear && endMonth === prevMonth) {
          grouped[profId].mesAnterior.push(alert);
        } else if (endYear === currentYear && endMonth === currentMonth) {
          grouped[profId].esteMes.push(alert);
        } else if (endYear === nextYear && endMonth === nextMonth) {
          grouped[profId].proximoMes.push(alert);
        }
      });

      const sortAlerts = (arr: PlanAlert[]) => arr.sort((a, b) => a.dataFinal.getTime() - b.dataFinal.getTime());

      const result: ProfessorAlerts[] = Object.entries(grouped)
        .map(([profId, alerts]) => ({
          professorId: profId,
          professorName: profId === "sem-professor" ? "Sem Professor" : (profNameMap[profId] || "Desconhecido"),
          mesAnterior: sortAlerts(alerts.mesAnterior),
          esteMes: sortAlerts(alerts.esteMes),
          proximoMes: sortAlerts(alerts.proximoMes),
        }))
        .filter((p) => p.mesAnterior.length + p.esteMes.length + p.proximoMes.length > 0)
        .sort((a, b) => a.professorName.localeCompare(b.professorName));

      return result;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const professors = Array.isArray(data) ? data : [];
  const total = professors.reduce((sum, p) => sum + p.mesAnterior.length + p.esteMes.length + p.proximoMes.length, 0);

  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAnteriorLabel = prevDate.toLocaleDateString("pt-BR", { month: "long" });
  const mesAtualLabel = now.toLocaleDateString("pt-BR", { month: "long" });
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const proximoMesLabel = nextDate.toLocaleDateString("pt-BR", { month: "long" });

  const renderAlerts = (alerts: PlanAlert[]) => {
    if (alerts.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-2">Nenhum</p>;
    }
    return alerts.map((a) => {
      const isPast = a.dataFinal < now;
      return (
        <div
          key={`${a.alunoId}-${a.dataFinal.toISOString()}`}
          className="flex items-center justify-between p-2 rounded-md bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors"
          onClick={() => navigate(`/alunos/${a.alunoId}`)}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{a.alunoNome}</p>
            <p className="text-xs text-muted-foreground">
              {a.planoTipo} • {a.dataFinal.toLocaleDateString("pt-BR")}
            </p>
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ml-2 ${isPast ? "status-urgent" : "status-warning"}`}>
            {isPast ? "Vencido" : "Vence"}
          </Badge>
        </div>
      );
    });
  };

  if (professors.length === 0) {
    return (
      <div className="glass-card rounded-lg p-5">
        <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-warning" />
          Alerta Administrativo
        </h3>
        <p className="text-sm text-muted-foreground text-center py-3">Nenhum vencimento pendente 🎉</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-warning" />
        Alerta Administrativo
        {total > 0 && <Badge variant="destructive" className="ml-auto">{total}</Badge>}
      </h3>

      <ScrollArea className="w-full">
        <div className="flex gap-4" style={{ minWidth: professors.length > 1 ? `${professors.length * 280}px` : "100%" }}>
          {professors.map((prof) => (
            <div key={prof.professorId} className="flex-1 min-w-[260px] space-y-3 border border-border rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground text-center border-b border-border pb-2">
                {prof.professorName}
              </p>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                  {mesAnteriorLabel} (anterior)
                </p>
                <div className="space-y-1.5">{renderAlerts(prof.mesAnterior)}</div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  {mesAtualLabel} (atual)
                </p>
                <div className="space-y-1.5">{renderAlerts(prof.esteMes)}</div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                  {proximoMesLabel} (próximo)
                </p>
                <div className="space-y-1.5">{renderAlerts(prof.proximoMes)}</div>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
