import { useState } from "react";
import { Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import type { ExercicioSugerido } from "./aquecimentoSugestoes";

interface Props {
  exercicios: ExercicioSugerido[];
  /** Rótulo da articulação/músculo, usado no estado vazio. */
  chaveLabel?: string;
  compact?: boolean;
}

export function ExerciciosSugeridosList({ exercicios, chaveLabel, compact }: Props) {
  const [demo, setDemo] = useState<{ nome: string; url: string } | null>(null);

  if (exercicios.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground mt-2">
        Nenhum exercício de aquecimento vinculado{chaveLabel ? ` a ${chaveLabel}` : ""} ainda. Vincule no Banco de Exercícios.
      </p>
    );
  }

  const embed = demo ? getYouTubeEmbedUrl(demo.url) : null;

  return (
    <>
      <div className={`mt-2 ${compact ? "" : "space-y-1"}`}>
        {!compact && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Exercícios de aquecimento sugeridos
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {exercicios.map((ex) => (
            <span
              key={ex.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
              title={ex.categoria ?? undefined}
            >
              {ex.nome}
              {ex.video_url && (
                <button
                  type="button"
                  onClick={() => setDemo({ nome: ex.nome, url: ex.video_url! })}
                  className="text-primary hover:opacity-80"
                  aria-label={`Ver vídeo de ${ex.nome}`}
                >
                  <Video className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      <Dialog open={!!demo} onOpenChange={(o) => !o && setDemo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{demo?.nome}</DialogTitle>
          </DialogHeader>
          {demo && (embed ? (
            <iframe src={embed} className="w-full aspect-video rounded" allow="autoplay; encrypted-media" allowFullScreen title={demo.nome} />
          ) : (
            <video src={demo.url} controls className="w-full rounded max-h-[70vh]" />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
