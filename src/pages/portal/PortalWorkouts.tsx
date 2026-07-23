import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Dumbbell, CheckCircle2, Play, ChevronLeft, History } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePortalWorkout } from "@/hooks/usePortalWorkout";
import { WorkoutDayFilter } from "@/components/portal/WorkoutDayFilter";
import { WorkoutBlockCard } from "@/components/portal/WorkoutBlockCard";
import { WorkoutWeeklyProgress } from "@/components/portal/WorkoutWeeklyProgress";
import { WorkoutScheduleCard } from "@/components/portal/WorkoutScheduleCard";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { cn } from "@/lib/utils";

const DAY_MAP: Record<number, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
  5: "T1",
  6: "T2",
  0: "T3",
};

function exerciseKey(ex: WorkoutExercise, index: number): string {
  return `${ex.ordem}-${ex.exercicio}-${index}`;
}

function filterByDay<T extends WorkoutExercise>(exercises: T[], day: string | null): T[] {
  if (!day) return exercises;
  return exercises.filter((ex) => {
    if (!ex.dias || ex.dias.length === 0) return true;
    return ex.dias.includes(day);
  });
}

export default function PortalWorkouts() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [exModal, setExModal] = useState<WorkoutExercise | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const {
    treino,
    workout,
    isLoadingTreino,
    progresso,
    agendamentos,
    refetch,
  } = usePortalWorkout(student?.id);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const diaSugerido = DAY_MAP[new Date().getDay()] ?? "T1";

  const meta = student?.frequencia_semanal || 3;
  const feitos = progresso.length;
  const concluidoHoje = progresso.some((p) => p.treino_id === treino?.id && p.data === hoje);

  const aquecimento = useMemo(
    () => filterByDay(workout?.aquecimento || [], selectedDay),
    [workout?.aquecimento, selectedDay]
  );

  const treinos = useMemo(
    () =>
      (workout?.treinos || []).map((t) => ({
        ...t,
        exercicios: filterByDay(t.exercicios, selectedDay),
      })),
    [workout?.treinos, selectedDay]
  );

  const hasDias = useMemo(() => {
    const all = [
      ...(workout?.aquecimento || []),
      ...(workout?.treinos || []).flatMap((t) => t.exercicios),
    ];
    return all.some((ex) => ex.dias && ex.dias.length > 0);
  }, [workout]);

  const marcar = useMutation({
    mutationFn: async () => {
      if (!treino || !student) return;
      const { error } = await supabase.from("student_workout_progress").insert({
        aluno_id: student.id,
        treino_id: treino.id,
        data: hoje,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-progress", student?.id] });
      qc.invalidateQueries({ queryKey: ["portal-streak-real", student?.id] });
      toast.success("Treino concluído! 💪");
      refetch();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate")) toast.info("Você já marcou este treino hoje.");
      else toast.error(msg || "Erro ao marcar");
    },
  });

  const toggleCompleted = (key: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!student) return null;

  if (isLoadingTreino) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-32 bg-muted rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!treino || !workout) {
    return (
      <div className="space-y-5 animate-fade-in pb-28">
        <div>
          <h1
            className="text-2xl font-black tracking-tight text-foreground"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            Treinos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">FORTEM · Portal do Aluno</p>
        </div>

        <Card className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2C2C2C] flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-7 h-7 text-primary" />
          </div>
          <p className="font-bold text-base text-foreground mb-1">Nenhum treino prescrito</p>
          <p className="text-sm text-muted-foreground">
            Fale com seu professor para liberar seu treino personalizado.
          </p>
        </Card>
      </div>
    );
  }

  const totalExercicios =
    aquecimento.length + treinos.reduce((acc, t) => acc + t.exercicios.length, 0);
  const concluidosCount = completed.size;

  return (
    <div className="space-y-5 animate-fade-in pb-28">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-black tracking-tight text-foreground"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            Treino Atual
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">FORTEM · Portal do Aluno</p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] border-primary/30 text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0"
        >
          v{treino.versao}
        </Badge>
      </div>

      {/* Info do treino */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className="font-bold text-base text-foreground truncate"
              style={{ fontFamily: "Archivo, sans-serif" }}
            >
              {treino.descricao?.trim() || "Treino Personalizado"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {totalExercicios} exercícios · {concluidosCount}/{totalExercicios} concluídos
            </p>
          </div>
          <Button
            size="sm"
            disabled={concluidoHoje || marcar.isPending}
            onClick={() => marcar.mutate()}
            className={cn(
              "shrink-0 rounded-full",
              concluidoHoje && "bg-emerald-500/80 hover:bg-emerald-500/80"
            )}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {concluidoHoje ? "Concluído hoje" : "Marcar concluído"}
          </Button>
        </div>
      </div>

      {/* Filtro de dia */}
      {hasDias && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Filtrar dia
          </p>
          <WorkoutDayFilter value={selectedDay} onChange={setSelectedDay} />
        </div>
      )}

      {!selectedDay && hasDias && (
        <p className="text-[11px] text-muted-foreground -mt-3">
          Sugestão de hoje: <span className="text-primary font-semibold">{diaSugerido}</span>
        </p>
      )}

      {/* Progresso semanal */}
      <WorkoutWeeklyProgress feitos={feitos} meta={meta} />

      {/* Próximos agendamentos */}
      <WorkoutScheduleCard agendamentos={agendamentos} />

      {/* Aquecimento */}
      {aquecimento.length > 0 && (
        <WorkoutBlockCard
          title="Aquecimento"
          subtitle="Liberação, mobilidade e ativação"
          exercises={aquecimento}
          onPick={setExModal}
          completedIds={completed}
          onToggle={toggleCompleted}
        />
      )}

      {/* Blocos de treino */}
      {treinos.map((t, i) => (
        <WorkoutBlockCard
          key={i}
          title={t.nome || `Treino ${i + 1}`}
          exercises={t.exercicios}
          onPick={setExModal}
          completedIds={completed}
          onToggle={toggleCompleted}
          defaultOpen={i === 0}
        />
      ))}

      {/* Histórico */}
      <TreinoHistorico alunoId={student.id} atualId={treino.id} />

      {/* Modal de exercício */}
      <ExerciseModal exercise={exModal} onClose={() => setExModal(null)} />
    </div>
  );
}

interface TreinoHistoricoItem {
  id: string;
  descricao: string | null;
  versao: number | null;
  status: string | null;
  data_inicio: string | null;
  created_at: string;
}

function TreinoHistorico({ alunoId, atualId }: { alunoId: string; atualId: string }) {
  const { data: historico = [], isLoading } = useQuery<TreinoHistoricoItem[]>({
    queryKey: ["portal-treinos-historico", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinos")
        .select("id, descricao, versao, status, data_inicio, created_at")
        .eq("aluno_id", alunoId)
        .neq("id", atualId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as TreinoHistoricoItem[];
    },
  });

  if (isLoading || historico.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <p
          className="text-sm font-bold text-foreground"
          style={{ fontFamily: "Archivo, sans-serif" }}
        >
          Histórico
        </p>
      </div>
      <div className="space-y-2">
        {historico.map((t) => (
          <Card
            key={t.id}
            className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">
                {t.descricao || "Treino"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                v{t.versao} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full",
                t.status === "aguardando"
                  ? "border-info/40 text-info bg-info/10"
                  : "border-muted-foreground/30 text-muted-foreground bg-muted/30"
              )}
            >
              {t.status === "aguardando" ? "Aguardando" : "Arquivado"}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExerciseModal({ exercise, onClose }: { exercise: WorkoutExercise | null; onClose: () => void }) {
  const embed = exercise?.video_url ? getYouTubeEmbedUrl(exercise.video_url) : null;
  const hasVideo = !!exercise?.video_url;

  return (
    <Dialog open={!!exercise} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle
            className="text-lg font-bold"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            {exercise?.exercicio || "Exercício"}
          </DialogTitle>
        </DialogHeader>
        {exercise && (
          <div className="space-y-4">
            {embed ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                <iframe
                  src={embed}
                  title={exercise.exercicio}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : hasVideo ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <video src={exercise.video_url!} controls className="w-full h-full" />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl bg-[#2C2C2C] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Play className="w-8 h-8 opacity-40" />
                Sem vídeo demonstrativo
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#1A1A1A] rounded-xl p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Séries</p>
                <p className="font-bold text-foreground">{exercise.series || "—"}</p>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Repetições</p>
                <p className="font-bold text-foreground">{exercise.repeticoes || "—"}</p>
              </div>
              <div className="col-span-2 bg-[#1A1A1A] rounded-xl p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoria</p>
                <p className="font-bold text-foreground">
                  {exercise.categoria}
                  {exercise.subcategoria ? ` · ${exercise.subcategoria}` : ""}
                </p>
              </div>
              {exercise.kg && (
                <div className="col-span-2 bg-[#1A1A1A] rounded-xl p-3 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Carga</p>
                  <p className="font-bold text-foreground">{exercise.kg}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
