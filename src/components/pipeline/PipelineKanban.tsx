import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineCard, type PipelineCardData } from "./PipelineCard";
import { PipelineLeadDrawer } from "./PipelineLeadDrawer";
import { MarkLostDialog } from "./MarkLostDialog";
import { stageColor, type Funnel, isLostStage, formatCurrencyBRL, computeTemperature } from "@/lib/pipeline";
import type { PipelineFiltersValue } from "./PipelineFilters";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  funnel: Funnel;
  probabilidade: number | null;
}

interface PipelineKanbanProps {
  funnel: Funnel;
  filters: PipelineFiltersValue;
}

function StageColumn({
  stage,
  students,
  totalValor,
  isOver,
  setRef,
  onOpenCard,
}: {
  stage: Stage;
  students: PipelineCardData[];
  totalValor: number;
  isOver: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  onOpenCard: (s: PipelineCardData) => void;
}) {
  const colors = stageColor(stage.color);
  return (
    <div
      ref={setRef}
      className={cn(
        "flex flex-col w-[272px] shrink-0 rounded-lg border bg-card/40 transition-colors",
        colors.border,
        isOver && "ring-2 ring-primary/60 bg-card/80",
      )}
    >
      <div className={cn("px-3 py-2 rounded-t-lg space-y-1", colors.bg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
            <span className={cn("text-xs font-semibold truncate", colors.text)}>{stage.name}</span>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
            {students.length} {students.length === 1 ? "lead" : "leads"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-emerald-300 font-semibold tabular-nums">
            {totalValor > 0 ? `${formatCurrencyBRL(totalValor)}/mês` : "—"}
          </span>
          {stage.probabilidade != null && !isLostStage(stage.name) && (
            <span className="text-muted-foreground tabular-nums">{stage.probabilidade}%</span>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {students.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 italic">Vazio</p>
        ) : (
          students.map((s) => <PipelineCard key={s.id} student={s} onOpen={onOpenCard} />)
        )}
      </div>
    </div>
  );
}

function DroppableColumn(props: { stage: Stage; students: PipelineCardData[]; totalValor: number; onOpenCard: (s: PipelineCardData) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.stage.id });
  return <StageColumn {...props} isOver={isOver} setRef={setNodeRef} />;
}

export function PipelineKanban({ funnel, filters }: PipelineKanbanProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStudent, setActiveStudent] = useState<PipelineCardData | null>(null);
  const [drawerStudent, setDrawerStudent] = useState<PipelineCardData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingLost, setPendingLost] = useState<{ aluno: PipelineCardData; destinoStage: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages", funnel],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,funnel,probabilidade")
        .eq("is_active", true)
        .eq("funnel", funnel)
        .order("position") as any);
      if (error) throw error;
      return (data || []) as Stage[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: allStages = [] } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,funnel,probabilidade")
        .eq("is_active", true)
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
        .select("id,nome,foto_url,responsavel_id,current_pipeline_stage_id,motivo_perda")
        .not("current_pipeline_stage_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metadata = [] } = useQuery({
    queryKey: ["pipeline-metadata"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_metadata")
        .select("aluno_id,temperatura_lead,valor_estimado_plano,origem_lead,plano_interesse,last_contact_at,updated_at");
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

  function isThisWeek(d?: string | null) {
    if (!d) return false;
    const dt = new Date(d).getTime();
    return Date.now() - dt <= 7 * 86400000;
  }

  const filtered = useMemo(() => {
    const term = (filters.search || "").trim().toLowerCase();
    return alunos.filter((a: any) => {
      if (term && !a.nome.toLowerCase().includes(term)) return false;
      if (filters.professorId && a.responsavel_id !== filters.professorId) return false;
      if (filters.origem) {
        const meta = metaMap[a.id];
        if (!meta || meta.origem_lead !== filters.origem) return false;
      }
      // Quick filters
      if (filters.quick === "meus") {
        if (!user || a.responsavel_id !== user.id) return false;
      }
      if (filters.quick === "quentes" || filters.quick === "parados") {
        const meta = metaMap[a.id];
        const cands = [meta?.last_contact_at, meta?.updated_at, lastMovesMap[a.id]].filter(Boolean) as string[];
        const last = cands.length ? new Date(Math.max(...cands.map((d) => new Date(d).getTime()))).toISOString() : null;
        const t = computeTemperature(last);
        if (filters.quick === "quentes" && t !== "quente") return false;
        if (filters.quick === "parados" && t !== "parado") return false;
      }
      if (filters.quick === "semana") {
        if (!isThisWeek(lastMovesMap[a.id])) return false;
      }
      return true;
    });
  }, [alunos, filters, metaMap, lastMovesMap, user]);

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
        motivo_perda: a.motivo_perda,
        current_stage_name: stage?.name,
        current_stage_probabilidade: stage?.probabilidade ?? null,
        current_funnel: stage?.funnel,
        meta: metaMap[a.id],
        last_moved_at: lastMovesMap[a.id],
        next_task: nextTasksMap[a.id] || null,
      });
    });
    return map;
  }, [stages, filtered, profilesMap, metaMap, lastMovesMap, nextTasksMap]);

  const totaisPorStage = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(byStage).forEach(([k, list]) => {
      m[k] = list.reduce((acc, s) => acc + Number(s.meta?.valor_estimado_plano || 0), 0);
    });
    return m;
  }, [byStage]);

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

    const student = findStudent(alunoId);

    // Se destino é "perdido" → abrir modal de motivo obrigatório (não move ainda)
    if (isLostStage(targetStage.name) && student) {
      setPendingLost({ aluno: student, destinoStage: targetStage.name });
      return;
    }

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
          <Skeleton key={i} className="h-[400px] w-[272px] shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {stages.map((stage) => (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              students={byStage[stage.id] || []}
              totalValor={totaisPorStage[stage.id] || 0}
              onOpenCard={(s) => { setDrawerStudent(s); setDrawerOpen(true); }}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeStudent && (
          <div className="w-[256px] rotate-2">
            <PipelineCard student={activeStudent} draggable={false} />
          </div>
        )}
      </DragOverlay>

      <PipelineLeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        student={drawerStudent}
        stages={allStages}
      />

      {pendingLost && (
        <MarkLostDialog
          open={!!pendingLost}
          onOpenChange={(o) => { if (!o) setPendingLost(null); }}
          alunoId={pendingLost.aluno.id}
          alunoNome={pendingLost.aluno.nome}
          destinoStage={pendingLost.destinoStage}
        />
      )}
    </DndContext>
  );
}
