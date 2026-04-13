import { type Student, mockTasks } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, AlertCircle, CheckCircle } from "lucide-react";

const priorityClass: Record<string, string> = { alta: 'status-urgent', media: 'status-warning', baixa: 'status-info' };

export function StudentTasks({ student }: { student: Student }) {
  const tasks = mockTasks.filter(t => t.studentId === student.id);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Tarefas</h3>
        <Button size="sm"><Plus className="w-3 h-3 mr-1" /> Nova Tarefa</Button>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa para este aluno</p>
        )}
        {tasks.map(task => (
          <div key={task.id} className="glass-card rounded-lg p-4 flex items-start gap-3">
            {task.status === 'atrasada' ? <AlertCircle className="w-4 h-4 text-destructive mt-0.5" /> :
             task.status === 'concluida' ? <CheckCircle className="w-4 h-4 text-success mt-0.5" /> :
             <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">{task.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{task.responsible} · {task.dueDate} {task.auto && '· Automática'}</p>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${priorityClass[task.priority]}`}>{task.priority}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
