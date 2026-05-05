import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  type: string;
  severity: "atencao" | "urgente";
  studentName: string;
  message: string;
  alunoId?: string;
}

interface Props {
  professorId: string | null;
}

const WEEKS_BY_FREQ: Record<number, number> = { 1: 12, 2: 8, 3: 6 };
const DEFAULT_WEEKS = 6;

export function AlertsWidget({ professorId }: Props) {
  const navigate = useNavigate();

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts", professorId],
    queryFn: async () => {
      const result: Alert[] = [];
      const today = new Date();

      const [alunosRes, treinosRes, avaliacoesRes, tarefasRes] = await Promise.all([
        supabase.from("alunos").select("id, nome, status, frequencia_semanal, responsavel_id"),
        supabase.from("treinos").select("id, aluno_id, created_at, status").eq("status", "atual"),
        supabase.from("avaliacoes").select("id, aluno_id, data, tipo").eq("tipo", "funcional").order("data", { ascending: false }),
        supabase.from("tarefas").select("id, aluno_id, responsavel_id, data_limite, status, tipo_auto").eq("tipo_auto", "atualizar_treino").neq("status", "concluida"),
      ]);

      const alunos = alunosRes.data || [];
      const treinos = treinosRes.data || [];
      const avaliacoes = avaliacoesRes.data || [];
      const tarefasAtualizar = tarefasRes.data || [];

      const alunoMap: Record<string, { nome: string; freq: number | null; status: string; responsavel_id: string | null }> = {};
      alunos.forEach((a) => {
        alunoMap[a.id] = { nome: a.nome, freq: a.frequencia_semanal, status: a.status, responsavel_id: a.responsavel_id };
      });

      const isMyStudent = (alunoId: string) => {
        if (!professorId) return true;
        return alunoMap[alunoId]?.responsavel_id === professorId;
      };

      // Troca de ficha
      treinos.forEach((t) => {
        if (!isMyStudent(t.aluno_id)) return;
        const aluno = alunoMap[t.aluno_id];
        if (!aluno || aluno.status !== "ativo") return;
        const freq = aluno.freq ?? 0;
        const weeksLimit = WEEKS_BY_FREQ[freq] || DEFAULT_WEEKS;
        const treinoDate = new Date(t.created_at);
        const limitDate = new Date(treinoDate);
        limitDate.setDate(limitDate.getDate() + weeksLimit * 7);
        const diffDays = Math.ceil((limitDate.getTime() - today.getTime()) / 86400000);
        if (diffDays <= 14) {
          result.push({
            id: `troca-${t.id}`, type: "troca_ficha",
            severity: diffDays <= 0 ? "urgente" : "atencao",
            studentName: aluno.nome,
            message: diffDays <= 0
              ? `Troca de ficha atrasada (${Math.abs(diffDays)} dias)`
              : `Troca de ficha em ${diffDays} dias (${weeksLimit} sem.)`,
            alunoId: t.aluno_id,
          });
        }
      });

      // Reavaliação funcional
      const lastAvalByAluno: Record<string, string> = {};
      avaliacoes.forEach((av) => {
        if (!lastAvalByAluno[av.aluno_id]) lastAvalByAluno[av.aluno_id] = av.data;
      });

      alunos.filter((a) => a.status === "ativo" && isMyStudent(a.id)).forEach((a) => {
        const lastDate = lastAvalByAluno[a.id];
        if (!lastDate) return;
        const last = new Date(lastDate + "T00:00:00");
        const months4 = new Date(last); months4.setMonth(months4.getMonth() + 4);
        const months6 = new Date(last); months6.setMonth(months6.getMonth() + 6);
        if (today >= months4) {
          result.push({
            id: `aval-${a.id}`, type: "avaliacao",
            severity: today >= months6 ? "urgente" : "atencao",
            studentName: a.nome,
            message: today >= months6
              ? `Reavaliação funcional atrasada (última: ${last.toLocaleDateString("pt-BR")})`
              : `Agendar reavaliação funcional (última: ${last.toLocaleDateString("pt-BR")})`,
            alunoId: a.id,
          });
        }
      });

      // Atualização de treino (tarefa automática)
      tarefasAtualizar.forEach((t) => {
        if (!t.aluno_id || !t.data_limite) return;
        if (professorId && t.responsavel_id !== professorId) return;
        const aluno = alunoMap[t.aluno_id];
        if (!aluno) return;
        const limit = new Date(t.data_limite + "T00:00:00");
        const diffDays = Math.ceil((limit.getTime() - today.getTime()) / 86400000);
        if (diffDays > 7) return;
        result.push({
          id: `att-${t.id}`,
          type: "atualizar_treino",
          severity: diffDays <= 0 ? "urgente" : "atencao",
          studentName: aluno.nome,
          message: diffDays <= 0
            ? `Atualização de treino atrasada (${Math.abs(diffDays)} dias)`
            : `Atualizar treino em ${diffDays} dia(s)`,
          alunoId: t.aluno_id,
        });
      });

      return result.sort((a, b) => (a.severity === "urgente" ? -1 : 1) - (b.severity === "urgente" ? -1 : 1));
    },
    staleTime: 60_000,
  });

  const iconMap: Record<string, React.ElementType> = {
    troca_ficha: RefreshCw, avaliacao: Clock,
  };
  const severityClass: Record<string, string> = { atencao: "status-warning", urgente: "status-urgent" };

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
            <div key={alert.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => alert.alunoId && navigate(`/alunos/${alert.alunoId}`)}>
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
