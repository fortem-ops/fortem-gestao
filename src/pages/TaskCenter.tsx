import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertCircle, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { RecordVideoUpload } from "@/components/tasks/RecordVideoUpload";

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
  aluno_id: string | null;
  responsavel_id: string;
  responsavel_nome?: string;
  aluno_nome?: string;
  atrasada?: boolean;
}

function RescheduleDialog({ task, onDone }: { task: TaskRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(task.data_limite || "");
  const [motivo, setMotivo] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  const mut = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Data obrigatória");
      if (motivo.trim().length < 5) throw new Error("Motivo deve ter ao menos 5 caracteres");
      if (data < todayStr) throw new Error("Data não pode ser no passado");
      const stamp = new Date().toLocaleDateString("pt-BR");
      const novaDescricao = `${task.descricao || ""}\n\n[Reagendado em ${stamp}]: ${motivo.trim()}`.trim();
      const { error } = await supabase
        .from("tarefas")
        .update({ data_limite: data, descricao: novaDescricao })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa reagendada");
      setOpen(false);
      setMotivo("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao reagendar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
          Reagendar
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Reagendar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nova data limite</Label>
            <Input type="date" min={todayStr} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Motivo (obrigatório)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do reagendamento..."
              rows={3}
            />
          </div>
          <Button className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
            Confirmar reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskList({
  tasks,
  onToggle,
  onRescheduled,
}: {
  tasks: TaskRow[];
  onToggle: (id: string, currentStatus: string) => void;
  onRescheduled: () => void;
}) {
  const navigate = useNavigate();

  if (tasks.length === 0)
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma tarefa
      </p>
    );

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isOverdue =
          task.status !== "concluida" &&
          task.data_limite &&
          task.data_limite < new Date().toISOString().split("T")[0];
        const isDone = task.status === "concluida";

        return (
          <div
            key={task.id}
            className="glass-card rounded-lg p-4 flex items-start gap-3"
          >
            <button
              onClick={() => onToggle(task.id, task.status)}
              className="mt-0.5 shrink-0"
              title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
            >
              {isOverdue ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : isDone ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() =>
                task.aluno_id && navigate(`/alunos/${task.aluno_id}`)
              }
            >
              <p
                className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
              >
                {task.titulo}
              </p>
              {task.descricao && task.tipo_auto !== "gravar_video" && (
                <p className="text-xs text-muted-foreground">
                  {task.descricao}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {task.responsavel_nome || "—"}
                {task.aluno_nome && ` · ${task.aluno_nome}`}
                {task.data_limite &&
                  ` · ${new Date(task.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`}
                {task.automatica && " · Automática"}
              </p>
            </div>
            {task.tipo_auto === "gravar_video" && !isDone && (
              <RecordVideoUpload taskId={task.id} descricao={task.descricao} />
            )}
            {!isDone && (
              <RescheduleDialog task={task} onDone={onRescheduled} />
            )}
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${priorityClass[task.prioridade] || ""}`}
            >
              {task.prioridade}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function NewTaskDialog({ onCreated, defaultResponsavelId }: { onCreated: () => void; defaultResponsavelId?: string | null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>(defaultResponsavelId || "");

  useEffect(() => {
    setResponsavelId(defaultResponsavelId || "");
  }, [defaultResponsavelId, open]);

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
      setResponsavelId("");
      onCreated();
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-3 h-3 mr-1" /> Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data limite</Label>
              <Input
                type="date"
                value={dataLimite}
                onChange={(e) => setDataLimite(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name}
                  </SelectItem>
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

export default function TaskCenter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("self");

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["taskcenter-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: professors = [] } = useQuery({
    queryKey: ["taskcenter-professors"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return (profiles || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!isCoordAdmin,
    staleTime: 5 * 60_000,
  });

  const effectiveResponsavelId = isCoordAdmin
    ? (selectedProfessorId === "todos"
        ? null
        : selectedProfessorId === "self"
          ? user?.id || null
          : selectedProfessorId)
    : user?.id || null;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tarefas-all", effectiveResponsavelId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("tarefas")
        .select("*")
        .order("data_limite", { ascending: true, nullsFirst: false });
      if (effectiveResponsavelId) q = q.eq("responsavel_id", effectiveResponsavelId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = [
        ...new Set(data.map((t) => t.responsavel_id)),
      ];
      const alunoIds = [
        ...new Set(data.filter((t) => t.aluno_id).map((t) => t.aluno_id!)),
      ];

      const [profilesRes, alunosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds),
        alunoIds.length
          ? supabase.from("alunos").select("id, nome").in("id", alunoIds)
          : Promise.resolve({ data: [] }),
      ]);

      const nameMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p) => {
        nameMap[p.user_id] = p.full_name;
      });
      const alunoMap: Record<string, string> = {};
      (alunosRes.data || []).forEach((a) => {
        alunoMap[a.id] = a.nome;
      });

      const todayStr = new Date().toISOString().split("T")[0];

      return data.map((t) => ({
        ...t,
        responsavel_nome: nameMap[t.responsavel_id] || "—",
        aluno_nome: t.aluno_id ? alunoMap[t.aluno_id] || "" : "",
        atrasada:
          t.status !== "concluida" && t.data_limite
            ? t.data_limite < todayStr
            : false,
      }));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: string;
    }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const handleToggle = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    toggleMutation.mutate({ id, newStatus });
  };

  const handleRescheduled = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
  };

  const pending = tasks.filter(
    (t) => t.status === "pendente" && !t.atrasada
  );
  const overdue = tasks.filter(
    (t) => t.status !== "concluida" && t.atrasada
  );
  const done = tasks.filter((t) => t.status === "concluida");
  const auto = tasks.filter((t) => t.automatica);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Central de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} tarefa(s) no total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCoordAdmin && (
            <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Minhas tarefas</SelectItem>
                <SelectItem value="todos">Todos os profissionais</SelectItem>
                {professors
                  .filter((p) => p.user_id !== user?.id)
                  .map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <NewTaskDialog
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: ["tarefas-all"] })
            }
          />
        </div>
      </div>
      <Tabs defaultValue="pendentes">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="pendentes">
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="atrasadas">
            Atrasadas ({overdue.length})
          </TabsTrigger>
          <TabsTrigger value="automaticas">
            Automáticas ({auto.length})
          </TabsTrigger>
          <TabsTrigger value="concluidas">
            Concluídas ({done.length})
          </TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <TaskList tasks={pending} onToggle={handleToggle} onRescheduled={handleRescheduled} />
        </TabsContent>
        <TabsContent value="atrasadas">
          <TaskList tasks={overdue} onToggle={handleToggle} onRescheduled={handleRescheduled} />
        </TabsContent>
        <TabsContent value="automaticas">
          <TaskList tasks={auto} onToggle={handleToggle} onRescheduled={handleRescheduled} />
        </TabsContent>
        <TabsContent value="concluidas">
          <TaskList tasks={done} onToggle={handleToggle} onRescheduled={handleRescheduled} />
        </TabsContent>
        <TabsContent value="todas">
          <TaskList tasks={tasks} onToggle={handleToggle} onRescheduled={handleRescheduled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
