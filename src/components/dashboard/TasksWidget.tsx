import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const priorityClass: Record<string, string> = {
  alta: "status-urgent",
  media: "status-warning",
  baixa: "status-info",
};

interface Props {
  professorId: string | null;
}

export function TasksWidget({ professorId }: Props) {
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-tarefas", professorId],
    queryFn: async () => {
      let q = supabase
        .from("tarefas")
        .select("id, titulo, prioridade, status, data_limite, responsavel_id")
        .neq("status", "concluida")
        .order("data_limite", { ascending: true, nullsFirst: false })
        .limit(5);
      if (professorId) q = q.eq("responsavel_id", professorId);
      const { data } = await q;
      if (!data?.length) return [];

      const userIds = [...new Set(data.map((t) => t.responsavel_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      return data.map((t) => ({
        ...t,
        responsavel_nome: nameMap[t.responsavel_id] || "—",
        atrasada: t.data_limite && t.data_limite < new Date().toISOString().split("T")[0],
      }));
    },
  });

  return (
    <div className="glass-card rounded-lg p-5 cursor-pointer" onClick={() => navigate("/tarefas")}>
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-info" />
        Tarefas Pendentes
      </h3>
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa pendente 🎉</p>
        ) : tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
            {task.atrasada ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            ) : (
              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{task.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {task.responsavel_nome}
                {task.data_limite && ` · ${new Date(task.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <Badge variant="outline" className={`shrink-0 text-xs ${priorityClass[task.prioridade] || ""}`}>
              {task.prioridade}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
