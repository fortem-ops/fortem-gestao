import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { Activity, ExternalLink, PlayCircle } from "lucide-react";
import { isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/youtube";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

interface TreinoRow {
  id: string;
  descricao: string;
  versao: number;
  status: string;
  conteudo: Json | null;
  aluno_id: string;
  created_at: string;
}

interface AlunoRow {
  id: string;
  nome: string;
}

const WARMUP_LABELS: Record<string, { label: string; tone: string }> = {
  LIB: { label: "LIBERAÇÃO", tone: "bg-red-600 text-white" },
  MOB: { label: "MOBILIDADE", tone: "bg-zinc-900 text-white" },
  ATI: { label: "ATIVAÇÃO", tone: "bg-zinc-300 text-zinc-900" },
};

/**
 * Public, read-only workout view — no authentication required.
 * Reached via QR code printed in the workout PDF so students can watch
 * the exercise videos on their phones during training.
 */
export default function PublicWorkout() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoRow | null>(null);
  const [aluno, setAluno] = useState<AlunoRow | null>(null);
  const [videoOpen, setVideoOpen] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    document.title = "Treino — Fortem";
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setError("Treino não encontrado.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data: t, error: tErr } = await supabase
          .from("treinos")
          .select("id, descricao, versao, status, conteudo, aluno_id, created_at")
          .eq("id", id)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!t) {
          if (!cancelled) {
            setError("Treino não encontrado ou não está mais disponível.");
            setLoading(false);
          }
          return;
        }
        const { data: a } = await supabase
          .from("alunos")
          .select("id, nome")
          .eq("id", t.aluno_id)
          .maybeSingle();
        if (cancelled) return;
        setTreino(t as TreinoRow);
        setAluno((a as AlunoRow) || null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const data = useMemo<WorkoutData | null>(() => {
    if (!treino?.conteudo) return null;
    return treino.conteudo as unknown as WorkoutData;
  }, [treino]);

  const openVideo = (url: string, title: string) => {
    if (isYouTubeUrl(url)) {
      setVideoOpen({ url, title });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !treino || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted flex items-center justify-center">
            <Activity className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-heading font-semibold">Treino indisponível</h1>
          <p className="text-sm text-muted-foreground">{error || "Não foi possível carregar este treino."}</p>
        </div>
      </div>
    );
  }

  // Group warm-up by category
  const warmupBlocks = (["LIB", "MOB", "ATI"] as const)
    .map((key) => ({
      key,
      ...WARMUP_LABELS[key],
      items: data.aquecimento.filter((ex) => ex.categoria === key),
    }))
    .filter((b) => b.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-sm leading-tight truncate">
                {treino.descricao || "Treino"}
              </h1>
              {aluno && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {aluno.nome} • v{treino.versao}
                </p>
              )}
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
            Somente leitura
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
        {/* Aquecimento */}
        {warmupBlocks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-heading font-bold uppercase tracking-wider text-primary">
              Aquecimento
            </h2>
            {warmupBlocks.map((bloco) => (
              <div key={bloco.key} className="rounded-xl border border-border overflow-hidden">
                <div className={`px-3 py-2 ${bloco.tone} flex items-center gap-2`}>
                  <span className="text-[10px] font-bold tracking-wider">{bloco.key}</span>
                  <span className="text-[11px] font-semibold opacity-90">{bloco.label}</span>
                </div>
                <ul className="divide-y divide-border">
                  {bloco.items.map((ex, idx) => (
                    <li key={idx} className="px-3 py-2.5 flex items-start gap-3">
                      <span className="text-[11px] text-muted-foreground tabular-nums w-5 pt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{ex.exercicio}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ex.repeticoes}
                          {ex.dias && ex.dias.length > 0 && (
                            <span className="ml-2">• {ex.dias.join(", ")}</span>
                          )}
                        </p>
                      </div>
                      {ex.video_url && (
                        <button
                          onClick={() => openVideo(ex.video_url!, ex.exercicio)}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                          aria-label={`Ver vídeo de ${ex.exercicio}`}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Vídeo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {/* Treinos de força */}
        {data.treinos.map((tr, tIdx) => {
          const blocoA = tr.exercicios.slice(0, 2);
          const blocoB = tr.exercicios.slice(2, 5);
          const renderBloco = (label: string, items: WorkoutExercise[]) => (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider text-foreground">
                  BLOCO {label}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {items.map((ex, idx) => (
                  <li key={idx} className="px-3 py-2.5 flex items-start gap-3">
                    <span className="text-[11px] text-muted-foreground tabular-nums w-5 pt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground">
                          {ex.categoria}
                        </span>
                        <p className="text-sm font-medium leading-snug">{ex.exercicio}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {ex.series} séries × {ex.repeticoes}
                        {ex.kg && <span className="ml-2">• {ex.kg} kg</span>}
                      </p>
                    </div>
                    {ex.video_url && (
                      <button
                        onClick={() => openVideo(ex.video_url!, ex.exercicio)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                        aria-label={`Ver vídeo de ${ex.exercicio}`}
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Vídeo
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
          return (
            <section key={tIdx} className="space-y-3">
              <h2 className="text-xs font-heading font-bold uppercase tracking-wider text-destructive">
                {tr.nome} — Força
              </h2>
              {blocoA.length > 0 && renderBloco("A", blocoA)}
              {blocoB.length > 0 && renderBloco("B", blocoB)}
            </section>
          );
        })}

        <footer className="pt-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            Fortem Gestão Técnica • Visualização do aluno
          </p>
        </footer>
      </main>

      {/* YouTube modal */}
      <Dialog open={videoOpen !== null} onOpenChange={(o) => !o && setVideoOpen(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-sm">{videoOpen?.title}</DialogTitle>
          </DialogHeader>
          {videoOpen && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={getYouTubeEmbedUrl(videoOpen.url) || videoOpen.url}
                title={videoOpen.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {videoOpen && (
            <div className="p-3 border-t border-border">
              <a
                href={videoOpen.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Abrir no YouTube
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
