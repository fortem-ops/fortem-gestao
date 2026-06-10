import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dumbbell, CheckCircle2, Play, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables, Json } from "@/integrations/supabase/types";
import { isPersonalizadoContent } from "@/components/student/workout/personalizadoTypes";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

function flatFromTreino(treino: Tables<"treinos">): WorkoutData {
  const c = treino.conteudo as Json | null;
  if (c && isPersonalizadoContent(c)) {
    return { aquecimento: c.aquecimento, treinos: c.treinos };
  }
  return (c as unknown as WorkoutData) || { aquecimento: [], treinos: [] };
}

export default function PortalWorkouts() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [exModal, setExModal] = useState<WorkoutExercise | null>(null);

  const { data: treinos = [] } = useQuery({
    queryKey: ["portal-treinos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      await supabase.rpc("ativar_treinos_agendados");
      const { data } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", student!.id)
        .order("created_at", { ascending: false });
      return (data || []) as Tables<"treinos">[];
    },
  });

  const atual = treinos.find((t) => t.status === "atual") || treinos[0];
  const historico = treinos.filter((t) => t.id !== atual?.id);

  // Progresso desta semana
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);

  const { data: progresso = [] } = useQuery({
    queryKey: ["portal-progress", student?.id, weekStart.toISOString()],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_workout_progress")
        .select("*")
        .eq("aluno_id", student!.id)
        .gte("data", format(weekStart, "yyyy-MM-dd"))
        .lte("data", format(weekEnd, "yyyy-MM-dd"));
      return data || [];
    },
  });

  const concluidoHoje = progresso.some(
    (p: any) => p.treino_id === atual?.id && p.data === format(new Date(), "yyyy-MM-dd"),
  );
  const meta = student?.frequencia_semanal || 3;
  const feitos = progresso.length;

  const marcar = useMutation({
    mutationFn: async () => {
      if (!atual || !student) return;
      const { error } = await supabase.from("student_workout_progress").insert({
        aluno_id: student.id,
        treino_id: atual.id,
        data: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-progress", student?.id] });
      toast.success("Treino concluído! 💪");
    },
    onError: (e: any) => {
      if (e.message?.includes("duplicate")) toast.info("Você já marcou este treino hoje.");
      else toast.error(e.message || "Erro ao marcar");
    },
  });

  const data = atual ? flatFromTreino(atual) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Progresso semanal */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Esta semana</p>
            <p className="text-lg font-heading font-bold">
              {feitos} <span className="text-sm text-muted-foreground font-normal">de {meta} treinos</span>
            </p>
          </div>
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <Progress value={Math.min(100, (feitos / meta) * 100)} className="h-2" />
      </Card>

      {!atual ? (
        <Card className="glass-card p-8 text-center text-sm text-muted-foreground">
          Nenhum treino prescrito ainda. Fale com seu professor.
        </Card>
      ) : (
        <>
          {/* Treino atual */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" /> Treino atual
              </h2>
              <Button
                size="sm"
                disabled={concluidoHoje || marcar.isPending}
                onClick={() => marcar.mutate()}
                className={concluidoHoje ? "bg-success/80" : ""}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {concluidoHoje ? "Concluído hoje" : "Marcar concluído"}
              </Button>
            </div>

            <Card className="glass-card p-4">
              <div className="mb-3">
                <p className="font-semibold">{atual.descricao}</p>
                <p className="text-xs text-muted-foreground">v{atual.versao}</p>
              </div>

              {data?.aquecimento && data.aquecimento.length > 0 && (
                <ExerciseGroup title="Aquecimento" exercicios={data.aquecimento} onPick={setExModal} />
              )}
              {data?.treinos.map((t, i) => (
                <ExerciseGroup key={i} title={t.nome} exercicios={t.exercicios} onPick={setExModal} />
              ))}
            </Card>
          </section>

          {/* Histórico */}
          {historico.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Histórico
              </h2>
              <div className="space-y-2">
                {historico.map((t) => (
                  <Card key={t.id} className="glass-card p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        v{t.versao} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {t.status === "aguardando" ? (
                      <Badge variant="outline" className="text-[10px] border-info/40 text-info bg-info/10">
                        Aguardando{(t as { data_inicio?: string | null }).data_inicio ? ` — ${new Date((t as { data_inicio: string }).data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Arquivado</Badge>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ExerciseModal exercise={exModal} onClose={() => setExModal(null)} />
    </div>
  );
}

function ExerciseGroup({
  title,
  exercicios,
  onPick,
}: {
  title: string;
  exercicios: WorkoutExercise[];
  onPick: (e: WorkoutExercise) => void;
}) {
  if (!exercicios || exercicios.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</p>
      <div className="space-y-1.5">
        {exercicios.map((ex, i) => (
          <button
            key={i}
            onClick={() => onPick(ex)}
            className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Play className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ex.exercicio || "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                {ex.categoria}{ex.subcategoria ? ` · ${ex.subcategoria}` : ""} · {ex.series}x{ex.repeticoes}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExerciseModal({ exercise, onClose }: { exercise: WorkoutExercise | null; onClose: () => void }) {
  const embed = exercise?.video_url ? getYouTubeEmbedUrl(exercise.video_url) : null;
  return (
    <Dialog open={!!exercise} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{exercise?.exercicio || "Exercício"}</DialogTitle>
        </DialogHeader>
        {exercise && (
          <div className="space-y-4">
            {embed ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                <iframe
                  src={embed}
                  title={exercise.exercicio}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : exercise.video_url ? (
              <video src={exercise.video_url} controls className="w-full rounded-lg bg-black" />
            ) : (
              <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                Sem vídeo demonstrativo
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Séries</p>
                <p className="font-semibold">{exercise.series || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Repetições</p>
                <p className="font-semibold">{exercise.repeticoes || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase">Categoria</p>
                <p className="font-semibold">
                  {exercise.categoria}{exercise.subcategoria ? ` · ${exercise.subcategoria}` : ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
