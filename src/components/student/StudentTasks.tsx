import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { RescheduleDialog } from "@/components/tasks/RescheduleDialog";

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
  tipo_auto: string | null;
  responsavel_id: string;
  responsavel_nome?: string;
}

function NewStudentTaskDialog({
  alunoId,
  defaultResponsavelId,
  onCreated,
}: {
  alunoId: string;
  defaultResponsavelId?: string | null;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>(defaultResponsavelId || "");

  useEffect(() => {
    setResponsavelId(defaultResponsavelId || user?.id || "");
  }, [defaultResponsavelId, open, user?.id]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .order("full_name");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tarefas").insert({
        titulo,
        descricao: descricao || null,
        prioridade,
        data_limite: dataLimite || null,
        aluno_id: alunoId,
        responsavel_id: responsavelId || user!.id,
        criado_por_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada");
      setOpen(false);
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setDataLimite("");
      onCreated();
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-3 h-3 mr-1" /> Nova Tarefa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data limite</Label>
              <Input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!titulo || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Criar Tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskItem({
  task,
  onToggle,
  onRescheduled,
  highlight,
}: {
  task: TaskRow;
  onToggle: (id: string, status: string) => void;
  onRescheduled: () => void;
  highlight?: "overdue" | "done";
}) {
  const isDone = task.status === "concluida";
  const Icon = highlight === "overdue" ? AlertCircle : isDone ? CheckCircle : Clock;
  const iconColor =
    highlight === "overdue" ? "text-destructive" : isDone ? "text-success" : "text-muted-foreground";

  return (
    <div className="glass-card rounded-lg p-4 flex items-start gap-3">
      <button
        onClick={() => onToggle(task.id, task.status)}
        className="mt-0.5 shrink-0"
        title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.titulo}
        </p>
        {task.descricao && (
          <p className="text-xs text-muted-foreground whitespace-pre-line">{task.descricao}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {task.responsavel_nome || "—"}
          {task.data_limite && ` · ${new Date(task.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`}
        </p>
      </div>
      {!isDone && (
        <RescheduleDialog
          task={{ id: task.id, descricao: task.descricao, data_limite: task.data_limite }}
          onDone={onRescheduled}
        />
      )}
      {task.automatica && (
        <Badge variant="outline" className="text-[10px] shrink-0 border-info/30 text-info bg-info/10">
          Automática
        </Badge>
      )}
      <Badge variant="outline" className={`text-xs shrink-0 ${priorityClass[task.prioridade] || ""}`}>
        {task.prioridade}
      </Badge>
    </div>
  );
}

export function StudentTasks({ student }: { student: Tables<"alunos"> }) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tarefas-aluno", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("aluno_id", student.id)
        .order("data_limite", { ascending: true, nullsFirst: false });
      if (error) throw error;
      if (!data?.length) return [] as TaskRow[];

      const ids = [...new Set(data.map((t) => t.responsavel_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      return data.map((t) => ({ ...t, responsavel_nome: nameMap[t.responsavel_id] || "—" })) as TaskRow[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("tarefas").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas-aluno", student.id] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const handleToggle = (id: string, currentStatus: string) => {
    toggleMutation.mutate({ id, newStatus: currentStatus === "concluida" ? "pendente" : "concluida" });
  };

  const onChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas-aluno", student.id] });
    queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const overdue = tasks.filter((t) => t.status !== "concluida" && t.data_limite && t.data_limite < todayStr);
  const scheduled = tasks.filter((t) => t.status !== "concluida" && (!t.data_limite || t.data_limite >= todayStr));
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Tarefas</h3>
        <NewStudentTaskDialog
          alunoId={student.id}
          defaultResponsavelId={student.responsavel_id}
          onCreated={onChanged}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa para este aluno.</p>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Atrasadas ({overdue.length})
              </h4>
              {overdue.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={handleToggle} onRescheduled={onChanged} highlight="overdue" />
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Programadas ({scheduled.length})
            </h4>
            {scheduled.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma tarefa programada.</p>
            ) : (
              scheduled.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={handleToggle} onRescheduled={onChanged} />
              ))
            )}
          </section>

          {done.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Concluídas ({done.length})
              </h4>
              {done.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={handleToggle} onRescheduled={onChanged} highlight="done" />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
