import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { carregarTodasAsPaginas } from "@/lib/supabasePaginado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertCircle, CheckCircle, Plus, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { RecordVideoUpload } from "@/components/tasks/RecordVideoUpload";
import { RescheduleDialog } from "@/components/tasks/RescheduleDialog";
import { getTaskActionTarget } from "@/lib/taskAction";
import { agoraSaoPaulo, tarefaAtrasada } from "@/lib/tarefaAtraso";

import { AtividadeTipoSelector } from "@/components/pipeline/AtividadeTipoSelector";
import { ATIVIDADE_CONFIG, type TipoAtividade } from "@/lib/pipeline";
import { useUserRoles } from "@/hooks/useUserRoles";

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
  hora_limite?: string | null;

  automatica: boolean;
  tipo_auto: string | null;
  tipo_atividade: string | null;
  aluno_id: string | null;
  responsavel_id: string;
  responsavel_nome?: string;
  aluno_nome?: string;
  atrasada?: boolean;
}

function TaskList({
  tasks,
  onToggle,
  onRescheduled,
}: {
  tasks: TaskRow[];
  onToggle: (id: string) => void;
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
          task.data_limite &&
          task.data_limite < new Date().toISOString().split("T")[0];
        const isDone = false;


        const actionTarget = getTaskActionTarget(task);
        const fallbackTarget = task.aluno_id ? `/alunos/${task.aluno_id}` : null;
        const clickTarget = actionTarget || fallbackTarget;

        return (
          <div
            key={task.id}
            className="glass-card rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
              <button
                onClick={() => onToggle(task.id)}
                className="mt-0.5 shrink-0"
                title="Concluir tarefa"
              >
                {isOverdue ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <div
                className={`flex-1 min-w-0 ${clickTarget ? "cursor-pointer" : ""}`}
                onClick={() => clickTarget && navigate(clickTarget)}
              >
                <p
                  className={`text-sm font-medium break-words ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {task.titulo}
                </p>
                {task.descricao && task.tipo_auto !== "gravar_video" && (
                  <p className="text-xs text-muted-foreground break-words">
                    {task.descricao}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {task.responsavel_nome || "—"}
                  {task.aluno_nome && ` · ${task.aluno_nome}`}
                  {task.data_limite &&
                    ` · ${new Date(task.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`}
                  {task.automatica && " · Automática"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {task.tipo_auto === "gravar_video" && !isDone && (
                <RecordVideoUpload taskId={task.id} descricao={task.descricao} />
              )}
              {!isDone && actionTarget && (
                <Button
                  size="sm"
                  onClick={() => navigate(actionTarget)}
                  className="shrink-0"
                >
                  Realizar
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              {!isDone && (
                <RescheduleDialog task={task} onDone={onRescheduled} />
              )}
              {task.automatica && (
                <Badge variant="outline" className="text-[10px] shrink-0 border-info/30 text-info bg-info/10">
                  Automática
                </Badge>
              )}
              {task.tipo_atividade && task.tipo_atividade !== "tarefa" && ATIVIDADE_CONFIG[task.tipo_atividade as TipoAtividade] && (() => {
                const cfg = ATIVIDADE_CONFIG[task.tipo_atividade as TipoAtividade];
                const Icon = cfg.icon;
                return (
                  <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </Badge>
                );
              })()}
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${priorityClass[task.prioridade] || ""}`}
              >
                {task.prioridade}
              </Badge>
            </div>
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
  const [tipoAtividade, setTipoAtividade] = useState<TipoAtividade>("tarefa");

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
        tipo_atividade: tipoAtividade,
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
      setTipoAtividade("tarefa");
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
            <Label>Tipo de atividade</Label>
            <AtividadeTipoSelector
              value={tipoAtividade}
              onChange={(t) => {
                setTipoAtividade(t);
                if (!titulo.trim()) setTitulo(ATIVIDADE_CONFIG[t].defaultTitle);
              }}
              className="mt-1"
            />
          </div>
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

type TaskGroupId = "videos" | "treinos" | "avaliacoes" | "relatorios" | "ponto" | "comercial" | "outras";

const TASK_GROUPS: { id: TaskGroupId; label: string }[] = [
  { id: "videos", label: "Vídeos" },
  { id: "treinos", label: "Treinos" },
  { id: "avaliacoes", label: "Avaliações" },
  { id: "relatorios", label: "Relatórios" },
  { id: "ponto", label: "Ponto" },
  { id: "comercial", label: "Comercial" },
  { id: "outras", label: "Outras" },
];

function grupoDaTarefa(task: TaskRow & { origem?: string | null }): TaskGroupId {
  switch (task.tipo_auto) {
    case "gravar_video":
      return "videos";
    case "atualizar_treino":
      return "treinos";
    case "reavaliacao_funcional":
    case "avaliacao_funcional_agendada":
    case "relatorio_experimental":
      return "avaliacoes";
    case "relatorio_tecnico_forca":
    case "relatorio_tecnico_corrida":
    case "relatorio_reabilitacao":
      return "relatorios";

    case "ponto_fechamento":
      return "ponto";
    default:
      break;
  }
  if ((task as any).origem === "pipeline") return "comercial";
  return "outras";
}

function GroupedTaskTabs({
  tasks,
  counterClass,
  showVideos,
  onToggle,
  onRescheduled,
}: {
  tasks: TaskRow[];
  counterClass: string;
  showVideos: boolean;
  onToggle: (id: string) => void;
  onRescheduled: () => void;
}) {
  const buckets: Record<TaskGroupId, TaskRow[]> = {
    videos: [],
    treinos: [],
    avaliacoes: [],
    relatorios: [],
    ponto: [],
    comercial: [],
    outras: [],
  };
  tasks.forEach((t) => {
    const g = grupoDaTarefa(t);
    buckets[g === "videos" && !showVideos ? "outras" : g].push(t);
  });

  const visiveis = TASK_GROUPS.filter(
    (g) => buckets[g.id].length > 0 && (g.id !== "videos" || showVideos)
  );

  return (
    <Tabs defaultValue="todas" className="mt-3">
      <TabsList className="bg-secondary/30 border border-border flex-wrap h-auto">
        <TabsTrigger value="todas">
          Todas{" "}
          <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold ${counterClass}`}>
            {tasks.length}
          </span>
        </TabsTrigger>
        {visiveis.map((g) => (
          <TabsTrigger key={g.id} value={g.id}>
            {g.label}{" "}
            <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold ${counterClass}`}>
              {buckets[g.id].length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="todas">
        <TaskList tasks={tasks} onToggle={onToggle} onRescheduled={onRescheduled} />
      </TabsContent>
      {visiveis.map((g) => (
        <TabsContent key={g.id} value={g.id}>
          <TaskList tasks={buckets[g.id]} onToggle={onToggle} onRescheduled={onRescheduled} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default function TaskCenter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("self");

  const { data: roles } = useUserRoles();
  const isCoordAdmin = !!roles?.isCoordAdmin;
  const isAdmin = !!roles?.isAdmin;

  const { data: professors = [] } = useQuery({
    queryKey: ["taskcenter-professors"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_listar_profissionais");
      if (error) throw error;
      return (data || [])
        .map((p) => ({ user_id: p.user_id, full_name: p.full_name }))
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
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
    queryKey: ["tarefas-all", effectiveResponsavelId, isAdmin],
    enabled: !!user && !!roles,
    queryFn: async () => {
      const data = await carregarTodasAsPaginas<Tables<"tarefas">>({
        tabela: "tarefas",
        colunas: "*",
        ordenarPor: [
          { coluna: "data_limite", ascending: true, nullsFirst: false },
          { coluna: "id" },
        ],
        filtros: (q: any) => {
          let query = q.neq("status", "concluida");
          // Tarefas comerciais (pipeline) são exclusivas de administradores
          if (!isAdmin) query = query.neq("origem", "pipeline");
          if (effectiveResponsavelId) query = query.eq("responsavel_id", effectiveResponsavelId);
          return query;
        },
      });
      if (!data.length) return [];

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

      const agora = agoraSaoPaulo();

      return data.map((t) => ({
        ...t,
        responsavel_nome: nameMap[t.responsavel_id] || "—",
        aluno_nome: t.aluno_id ? alunoMap[t.aluno_id] || "" : "",
        atrasada:
          t.status !== "concluida" &&
          tarefaAtrasada(t.data_limite, (t as any).hora_limite, agora),
      }));

    },
  });

  const concluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa concluída");
      queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-badge"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
    },
    onError: () => toast.error("Erro ao concluir tarefa"),
  });

  const handleToggle = (id: string) => {
    concluirMutation.mutate(id);
  };

  const handleRescheduled = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas-all"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas-badge"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
  };

  const pending = tasks.filter(
    (t) => t.status === "pendente" && !t.atrasada
  );
  const overdue = tasks.filter((t) => t.atrasada);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Central de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} tarefa(s) no total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isCoordAdmin && (
            <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
              <SelectTrigger className="w-full sm:w-[220px]">
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
            defaultResponsavelId={effectiveResponsavelId}
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: ["tarefas-all"] })
            }
          />
        </div>
      </div>
      <Tabs defaultValue="pendentes">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="pendentes">
            Programadas{" "}
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-success text-success-foreground text-[11px] font-bold">
              {pending.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="atrasadas">
            Atrasadas{" "}
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold">
              {overdue.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <GroupedTaskTabs
            tasks={pending}
            counterClass="bg-success text-success-foreground"
            showVideos={isCoordAdmin}
            onToggle={handleToggle}
            onRescheduled={handleRescheduled}
          />
        </TabsContent>
        <TabsContent value="atrasadas">
          <GroupedTaskTabs
            tasks={overdue}
            counterClass="bg-destructive text-destructive-foreground"
            showVideos={isCoordAdmin}
            onToggle={handleToggle}
            onRescheduled={handleRescheduled}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}
