import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineCard, type PipelineCardData } from "./PipelineCard";
import { stageColor, type Funnel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  funnel: Funnel;
}

interface PipelineKanbanProps {
  funnel: Funnel;
  filters: {
    search?: string;
    professorId?: string | null;
    origem?: string | null;
  };
}

function StageColumn({
  stage,
  students,
  isOver,
  setRef,
}: {
  stage: Stage;
  students: PipelineCardData[];
  isOver: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const colors = stageColor(stage.color);
  return (
    <div
      ref={setRef}
      className={cn(
        "flex flex-col w-[260px] shrink-0 rounded-lg border bg-card/40 transition-colors",
        colors.border,
        isOver && "ring-2 ring-primary/60 bg-card/80",
      )}
    >
      <div className={cn("px-3 py-2 rounded-t-lg flex items-center justify-between gap-2", colors.bg)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
          <span className={cn("text-xs font-semibold truncate", colors.text)}>{stage.name}</span>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{students.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {students.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 italic">Vazio</p>
        ) : (
          students.map((s) => <PipelineCard key={s.id} student={s} />)
        )}
      </div>
    </div>
  );
}

function DroppableColumn(props: { stage: Stage; students: PipelineCardData[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.stage.id });
  return <StageColumn {...props} isOver={isOver} setRef={setNodeRef} />;
}

export function PipelineKanban({ funnel, filters }: PipelineKanbanProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStudent, setActiveStudent] = useState<PipelineCardData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages", funnel],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,funnel")
        .eq("is_active", true)
        .eq("funnel", funnel)
        .order("position") as any);
      if (error) throw error;
      return (data || []) as Stage[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["pipeline-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id,nome,foto_url,responsavel_id,current_pipeline_stage_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metadata = [] } = useQuery({
    queryKey: ["pipeline-metadata"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_metadata")
        .select("aluno_id,temperatura_lead,valor_estimado_plano,origem_lead");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["pipeline-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    },
    staleTime: 10 * 60_000,
  });

  const { data: lastMovesMap = {} } = useQuery({
    queryKey: ["pipeline-last-moves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_movements")
        .select("aluno_id,moved_at")
        .order("moved_at", { ascending: false })
        .limit(2000);
      const map: Record<string, string> = {};
      (data || []).forEach((m) => { if (!map[m.aluno_id]) map[m.aluno_id] = m.moved_at; });
      return map;
    },
  });

  const { data: nextTasksMap = {} } = useQuery({
    queryKey: ["pipeline-next-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id,aluno_id,titulo,data_limite")
        .eq("status", "pendente")
        .not("aluno_id", "is", null)
        .order("data_limite", { ascending: true, nullsFirst: false })
        .limit(2000);
      const map: Record<string, { id: string; titulo: string; data_limite: string | null }> = {};
      (data || []).forEach((t: any) => {
        if (!map[t.aluno_id]) map[t.aluno_id] = { id: t.id, titulo: t.titulo, data_limite: t.data_limite };
      });
      return map;
    },
  });

  const metaMap = useMemo(() => {
    const m: Record<string, any> = {};
    metadata.forEach((x: any) => { m[x.aluno_id] = x; });
    return m;
  }, [metadata]);

  const filtered = useMemo(() => {
    const term = (filters.search || "").trim().toLowerCase();
    return alunos.filter((a: any) => {
      if (term && !a.nome.toLowerCase().includes(term)) return false;
      if (filters.professorId && a.responsavel_id !== filters.professorId) return false;
      if (filters.origem) {
        const meta = metaMap[a.id];
        if (!meta || meta.origem_lead !== filters.origem) return false;
      }
      return true;
    });
  }, [alunos, filters, metaMap]);

  const byStage = useMemo(() => {
    const map: Record<string, PipelineCardData[]> = {};
    stages.forEach((s) => { map[s.id] = []; });
    filtered.forEach((a: any) => {
      const stageId = a.current_pipeline_stage_id;
      if (!stageId || !map[stageId]) return;
      const stage = stages.find((s) => s.id === stageId);
      map[stageId].push({
        id: a.id,
        nome: a.nome,
        foto_url: a.foto_url,
        responsavel_id: a.responsavel_id,
        responsavel_nome: a.responsavel_id ? profilesMap[a.responsavel_id] : null,
        current_stage_name: stage?.name,
        current_funnel: stage?.funnel,
        meta: metaMap[a.id],
        last_moved_at: lastMovesMap[a.id],
        next_task: nextTasksMap[a.id] || null,
      });
    });
    return map;
  }, [stages, filtered, profilesMap, metaMap, lastMovesMap, nextTasksMap]);

  function findStudent(id: string): PipelineCardData | null {
    for (const list of Object.values(byStage)) {
      const found = list.find((s) => s.id === id);
      if (found) return found;
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    const s = findStudent(String(e.active.id));
    setActiveStudent(s);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveStudent(null);
    if (!e.over) return;
    const alunoId = String(e.active.id);
    const toStageId = String(e.over.id);
    const targetStage = stages.find((s) => s.id === toStageId);
    if (!targetStage) return;

    const aluno = alunos.find((a: any) => a.id === alunoId);
    if (!aluno || aluno.current_pipeline_stage_id === toStageId) return;

    // Optimistic update
    queryClient.setQueryData(["pipeline-alunos"], (old: any) =>
      (old || []).map((a: any) => (a.id === alunoId ? { ...a, current_pipeline_stage_id: toStageId } : a))
    );

    const { error } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: alunoId,
      _to_stage_name: targetStage.name,
      _source: "manual",
      _notes: null,
      _moved_by: user?.id ?? null,
    } as any);

    if (error) {
      toast.error("Erro ao mover: " + error.message);
      queryClient.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    } else {
      toast.success(`Movido para ${targetStage.name}`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-last-moves"] });
    }
  }

  if (isLoading || stages.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[400px] w-[260px] shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {stages.map((stage) => (
            <DroppableColumn key={stage.id} stage={stage} students={byStage[stage.id] || []} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeStudent && (
          <div className="w-[244px] rotate-2">
            <PipelineCard student={activeStudent} draggable={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
