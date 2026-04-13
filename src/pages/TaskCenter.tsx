import { mockTasks } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

const priorityClass: Record<string, string> = { alta: 'status-urgent', media: 'status-warning', baixa: 'status-info' };

function TaskList({ tasks }: { tasks: typeof mockTasks }) {
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa</p>;
  return (
    <div className="space-y-2">
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
  );
}

export default function TaskCenter() {
  const pending = mockTasks.filter(t => t.status === 'pendente');
  const overdue = mockTasks.filter(t => t.status === 'atrasada');
  const auto = mockTasks.filter(t => t.auto);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Central de Tarefas</h1>
        <p className="text-sm text-muted-foreground mt-1">{mockTasks.length} tarefas no total</p>
      </div>
      <Tabs defaultValue="pendentes">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="pendentes">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="atrasadas">Atrasadas ({overdue.length})</TabsTrigger>
          <TabsTrigger value="automaticas">Automáticas ({auto.length})</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes"><TaskList tasks={pending} /></TabsContent>
        <TabsContent value="atrasadas"><TaskList tasks={overdue} /></TabsContent>
        <TabsContent value="automaticas"><TaskList tasks={auto} /></TabsContent>
        <TabsContent value="todas"><TaskList tasks={mockTasks} /></TabsContent>
      </Tabs>
    </div>
  );
}
