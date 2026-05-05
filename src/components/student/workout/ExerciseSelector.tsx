import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Video, X } from "lucide-react";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

interface ExerciseSelectorProps {
  categoria: string;
  value: string;
  onChange: (value: string, video?: string | null) => void;
  readOnly?: boolean;
  /** Sobrescreve a subcategoria derivada do código (usado em LIB/MOB/ATI). */
  subcategoria?: string;
  /** Desabilita o input quando true (ex: subcategoria ainda não escolhida). */
  disabled?: boolean;
  /** Placeholder customizado. */
  placeholder?: string;
}

interface GroupSelection { grupo: string; subcategoria: string }
interface BankExercise {
  id: string;
  nome: string;
  grupos: GroupSelection[];
  video_url: string | null;
  video_path: string | null;
}

import { categoriaToGrupoSub } from "@/lib/exerciseMapping";
import { useExerciseCategories } from "@/hooks/useExerciseCategories";

export function ExerciseSelector({ categoria, value, onChange, readOnly, subcategoria, disabled, placeholder }: ExerciseSelectorProps) {
  const { categories } = useExerciseCategories();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState<{ nome: string; url: string } | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const updateCoords = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(560, vw - 16);
    let left = r.left;
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    const top = r.bottom + 4;
    const maxHeight = Math.min(480, Math.max(180, vh - top - 16));
    setCoords({ top, left, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    const onResize = () => updateCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: exercicios = [] } = useQuery({
    queryKey: ["exercicios-bank-selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercicios_personalizados")
        .select("id, nome, grupos, video_url, video_path")
        .order("nome");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        grupos: (r.grupos as unknown as GroupSelection[]) || [],
        video_url: r.video_url,
        video_path: r.video_path,
      })) as BankExercise[];
    },
    staleTime: 60_000,
  });

  const grupoAlvo = CODE_TO_GRUPO[categoria.toUpperCase()] || categoria;
  const subAlvo = subcategoria ?? CODE_TO_SUBCATEGORIA[categoria.toUpperCase()];

  const candidatos = useMemo(() => {
    return exercicios.filter((ex) =>
      ex.grupos.some((g) => g.grupo === grupoAlvo && (!subAlvo || g.subcategoria === subAlvo)),
    );
  }, [exercicios, grupoAlvo, subAlvo]);

  const filtered = useMemo(() => {
    if (!query) return candidatos.slice(0, 60);
    const q = query.toLowerCase();
    return candidatos.filter((ex) => ex.nome.toLowerCase().includes(q)).slice(0, 60);
  }, [candidatos, query]);

  const resolveVideoUrl = (ex: BankExercise): string | null => {
    if (ex.video_url) return ex.video_url;
    if (ex.video_path) {
      const { data } = supabase.storage.from("exercicios-videos").getPublicUrl(ex.video_path);
      return data?.publicUrl ?? null;
    }
    return null;
  };

  const openDemo = (ex: BankExercise) => {
    const url = resolveVideoUrl(ex);
    if (url) setDemo({ nome: ex.nome, url });
  };

  if (readOnly) {
    return <span className="text-xs">{value || "—"}</span>;
  }

  const embed = demo ? getYouTubeEmbedUrl(demo.url) : null;

  return (
    <>
      <div ref={ref} className="relative">
        <div className="flex items-center">
          <Search className="w-3 h-3 text-muted-foreground absolute left-1 pointer-events-none" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            className="h-7 text-xs bg-transparent border-none pl-5 pr-1"
            placeholder={
              placeholder ??
              (subAlvo ? `Buscar em ${subAlvo}...` : `Buscar em ${grupoAlvo}...`)
            }
          />
        </div>
      </div>
      {open && !disabled && coords && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            width: coords.width,
            maxHeight: coords.maxHeight,
            zIndex: 60,
          }}
          className="overflow-y-auto bg-popover border border-border rounded-md shadow-xl"
        >
          <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur px-2 py-1.5 border-b border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              <strong className="text-foreground">{filtered.length}</strong> de {candidatos.length} em{" "}
              <strong className="text-foreground">{grupoAlvo}</strong>
              {subAlvo && <> · {subAlvo}</>}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hover:text-foreground p-0.5 rounded"
              aria-label="Fechar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {candidatos.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhum exercício cadastrado em <strong>{grupoAlvo}</strong>
              {subAlvo && <> · {subAlvo}</>}.
              <br />
              <span className="text-[10px]">Cadastre no Banco de Exercícios.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((ex) => {
                const hasVideo = !!ex.video_url || !!ex.video_path;
                const isSelected = ex.nome === value;
                return (
                  <li
                    key={ex.id}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors ${
                      isSelected ? "bg-primary/10" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left flex items-center gap-2"
                      onClick={() => { onChange(ex.nome, ex.video_url); setQuery(ex.nome); setOpen(false); }}
                    >
                      {hasVideo && <Video className="w-3 h-3 text-primary shrink-0" />}
                      <span className="truncate">{ex.nome}</span>
                    </button>
                    {hasVideo && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] shrink-0"
                        onClick={(e) => { e.stopPropagation(); openDemo(ex); }}
                      >
                        Demo
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}

      {/* Modal de demonstração — quase fullscreen com controles */}
      <Dialog open={!!demo} onOpenChange={(o) => !o && setDemo(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl p-0 overflow-hidden bg-background border-border">
          <DialogHeader className="px-4 py-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold truncate pr-8">
              {demo?.nome ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black aspect-video w-full">
            {demo && (
              embed ? (
                <iframe
                  src={`${embed}?autoplay=1&rel=0`}
                  title={demo.nome}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video
                  src={demo.url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full bg-black"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
