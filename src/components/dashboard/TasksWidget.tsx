import { mockTasks } from "@/lib/mock-data";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const priorityClass: Record<string, string> = {
  alta: "status-urgent",
  media: "status-warning",
  baixa: "status-info",
};

const statusIcon: Record<string, React.ElementType> = {
  pendente: Clock,
  atrasada: AlertCircle,
  concluida: CheckCircle,
};

export function TasksWidget() {
  const tasks = mockTasks.filter(t => t.status !== 'concluida').slice(0, 5);

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-info" />
        Tarefas Pendentes
      </h3>
      <div className="space-y-3">
        {tasks.map((task) => {
          const Icon = statusIcon[task.status] || Clock;
          return (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${task.status === 'atrasada' ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.responsible} · {task.dueDate}</p>
              </div>
              <Badge variant="outline" className={`shrink-0 text-xs ${priorityClass[task.priority]}`}>
                {task.priority}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
