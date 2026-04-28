import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Video } from "lucide-react";

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

import { CODE_TO_GRUPO, CODE_TO_SUBCATEGORIA } from "@/lib/exerciseMapping";

export function ExerciseSelector({ categoria, value, onChange, readOnly }: ExerciseSelectorProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
  const subAlvo = CODE_TO_SUBCATEGORIA[categoria.toUpperCase()];

  const candidatos = useMemo(() => {
    return exercicios.filter((ex) =>
      ex.grupos.some((g) => g.grupo === grupoAlvo && (!subAlvo || g.subcategoria === subAlvo)),
    );
  }, [exercicios, grupoAlvo, subAlvo]);

  const filtered = useMemo(() => {
    if (!query) return candidatos.slice(0, 30);
    const q = query.toLowerCase();
    return candidatos.filter((ex) => ex.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [candidatos, query]);

  if (readOnly) {
    return <span className="text-xs">{value || "—"}</span>;
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        <Search className="w-3 h-3 text-muted-foreground absolute left-1 pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-7 text-xs bg-transparent border-none pl-5 pr-1"
          placeholder={subAlvo ? `Buscar em ${subAlvo}...` : `Buscar em ${grupoAlvo}...`}
        />
      </div>
      {open && (
        <div className="absolute z-50 top-8 left-0 w-80 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
          {candidatos.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Nenhum exercício cadastrado em <strong>{grupoAlvo}</strong>
              {subAlvo && <> · {subAlvo}</>}.
              <br />
              <span className="text-[10px]">Cadastre no Banco de Exercícios.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            filtered.map((ex) => {
              const hasVideo = !!ex.video_url || !!ex.video_path;
              return (
                <button
                  key={ex.id}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent/50 flex items-center justify-between gap-1 transition-colors"
                  onClick={() => { onChange(ex.nome, ex.video_url); setQuery(ex.nome); setOpen(false); }}
                >
                  <span className="truncate flex-1">{ex.nome}</span>
                  {hasVideo && <Video className="w-3 h-3 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
