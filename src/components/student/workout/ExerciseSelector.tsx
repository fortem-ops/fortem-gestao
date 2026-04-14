import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Video } from "lucide-react";
import { EXERCISE_DATABASE, CATEGORY_FRIENDLY_NAMES, type Exercise } from "./exerciseDatabase";

interface ExerciseSelectorProps {
  categoria: string;
  value: string;
  onChange: (value: string, video?: string | null) => void;
  readOnly?: boolean;
}

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

  // Map workout category codes to exercise DB categories
  const dbCategories = useMemo(() => {
    const map: Record<string, string[]> = {
      LIB: Object.keys(EXERCISE_DATABASE).filter(k => k.startsWith("L_")),
      MOB: Object.keys(EXERCISE_DATABASE).filter(k => k.startsWith("M_")),
      ATI: Object.keys(EXERCISE_DATABASE).filter(k => k.startsWith("A_")),
    };
    // Direct match
    if (EXERCISE_DATABASE[categoria]) return [categoria];
    if (map[categoria]) return map[categoria];
    // Try uppercase
    const upper = categoria.toUpperCase();
    if (EXERCISE_DATABASE[upper]) return [upper];
    return [];
  }, [categoria]);

  const exercises = useMemo(() => {
    const all: (Exercise & { dbCat: string })[] = [];
    for (const cat of dbCategories) {
      const exs = EXERCISE_DATABASE[cat] || [];
      for (const ex of exs) {
        all.push({ ...ex, dbCat: cat });
      }
    }
    return all;
  }, [dbCategories]);

  const filtered = useMemo(() => {
    if (!query) return exercises.slice(0, 30);
    const q = query.toLowerCase();
    return exercises.filter(ex => ex.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [exercises, query]);

  if (readOnly) {
    return <span className="text-xs">{value || "—"}</span>;
  }

  if (exercises.length === 0) {
    return (
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
        className="h-7 text-xs bg-transparent border-none px-1"
        placeholder={CATEGORY_FRIENDLY_NAMES[categoria] || categoria}
      />
    );
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
          placeholder={`Buscar em ${dbCategories.length > 1 ? categoria : CATEGORY_FRIENDLY_NAMES[categoria] || categoria}...`}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-8 left-0 w-80 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
          {dbCategories.length > 1 && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/50 sticky top-0">
              {dbCategories.length} subcategorias disponíveis
            </div>
          )}
          {filtered.map((ex, i) => (
            <button
              key={`${ex.dbCat}-${i}`}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent/50 flex items-center justify-between gap-1 transition-colors"
              onClick={() => { onChange(ex.nome, ex.video); setQuery(ex.nome); setOpen(false); }}
            >
              <div className="flex-1 min-w-0">
                {dbCategories.length > 1 && (
                  <span className="text-[9px] text-muted-foreground mr-1">[{ex.dbCat}]</span>
                )}
                <span className="truncate">{ex.nome}</span>
              </div>
              {ex.video && <Video className="w-3 h-3 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
