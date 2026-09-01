import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, Plus } from "lucide-react";
import { ATIVIDADE_CONFIG, type TipoAtividade } from "@/lib/pipeline";
import { RescheduleDialog } from "@/components/tasks/RescheduleDialog";
import { ScheduleTaskDialog } from "./ScheduleTaskDialog";
import type { Tables } from "@/integrations/supabase/types";

const priorityClass: Record<string, string> = {
  alta: "status-urgent",
  media: "status-warning",
  baixa: "status-info",
};

interface TaskRow {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  data_limite: string | null;
  automatica: boolean;
  tipo_atividade: string | null;
  responsavel_id: string;
  responsavel_nome?: string;
}

function TaskItem({
  task,
  onToggle,
  onChanged,
  highlight,
}: {
  task: TaskRow;
  onToggle: (id: string, status: string) => void;
  onChanged: () => void;
  highlight?: "overdue" | "done";
}) {
  const isDone = task.status === "concluida";
  const Icon = highlight === "overdue" ? AlertCircle : isDone ? CheckCircle : Clock;
  const iconColor =
    highlight === "overdue" ? "text-destructive" : isDone ? "text-success" : "text-muted-foreground";
  const cfg = ATIVIDADE_CONFIG[(task.tipo_atividade as TipoAtividade) || "tarefa"];
  const AtvIcon = cfg?.icon;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
      <button onClick={() => onToggle(task.id, task.status)} className="mt-0.5 shrink-0" title={isDone ? "Reabrir" : "Concluir"}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.titulo}
        </p>
        {task.descricao && <p className="text-xs text-muted-foreground whitespace-pre-line">{task.descricao}</p>}
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
          {AtvIcon && <AtvIcon className="w-3 h-3" />}
          {cfg?.label || "Tarefa"}
          {" · "}
          {task.responsavel_nome || "—"}
          {task.data_limite && ` · ${new Date(task.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`}
        </p>
      </div>
      {!isDone && (
        <RescheduleDialog
          task={{ id: task.id, descricao: task.descricao, data_limite: task.data_limite }}
          onDone={onChanged}
        />
      )}
      {task.automatica && (
        <Badge variant="outline" className="text-[10px] shrink-0 border-info/30 text-info bg-info/10">Automática</Badge>
      )}
      <Badge variant="outline" className={`text-xs shrink-0 ${priorityClass[task.prioridade] || ""}`}>
        {task.prioridade}
      </Badge>
    </div>
  );
}

export function PipelineTasksPanel({ student }: { student: Tables<"alunos"> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["pipeline-tarefas-aluno", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("origem", "pipeline")
        .order("data_limite", { ascending: true, nullsFirst: false });
      if (error) throw error;
      if (!data?.length) return [] as TaskRow[];

      const ids = [...new Set(data.map((t: any) => t.responsavel_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
      return data.map((t: any) => ({ ...t, responsavel_nome: nameMap[t.responsavel_id] || "—" })) as TaskRow[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["pipeline-tarefas-aluno", student.id] });
    qc.invalidateQueries({ queryKey: ["pipeline-atividades-timeline", student.id] });
    qc.invalidateQueries({ queryKey: ["pipeline-lead-summary", student.id] });
    qc.invalidateQueries({ queryKey: ["tarefas-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    qc.invalidateQueries({ queryKey: ["registros-count", "tarefas", student.id] });
  }

  async function handleToggle(id: string, currentStatus: string) {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    const { error } = await supabase.from("tarefas").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar tarefa"); return; }
    invalidate();
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const overdue = tasks.filter((t) => t.status !== "concluida" && t.data_limite && t.data_limite < todayStr);
  const scheduled = tasks.filter((t) => t.status !== "concluida" && (!t.data_limite || t.data_limite >= todayStr));
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Atividades comerciais</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1 h-8">
          <Plus className="w-3.5 h-3.5" /> Nova atividade
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade comercial para este aluno.</p>
        ) : (
          <>
            {overdue.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive">Atrasadas ({overdue.length})</h4>
                {overdue.map((t) => (
                  <TaskItem key={t.id} task={t} onToggle={handleToggle} onChanged={invalidate} highlight="overdue" />
                ))}
              </section>
            )}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Programadas ({scheduled.length})</h4>
              {scheduled.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma atividade programada.</p>
              ) : (
                scheduled.map((t) => <TaskItem key={t.id} task={t} onToggle={handleToggle} onChanged={invalidate} />)
              )}
            </section>
            {done.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concluídas ({done.length})</h4>
                {done.map((t) => (
                  <TaskItem key={t.id} task={t} onToggle={handleToggle} onChanged={invalidate} highlight="done" />
                ))}
              </section>
            )}
          </>
        )}
      </CardContent>

      <ScheduleTaskDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) invalidate(); }}
        alunoId={student.id}
        alunoNome={student.nome}
        responsavelId={student.responsavel_id}
      />
    </Card>
  );
}
