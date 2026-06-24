import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";

type Tipo = "lead" | "prospect" | "ativo" | "inativo";

interface Resultado {
  id: string;
  nome: string;
  telefone: string | null;
  tipo: Tipo;
}

const PROSPECT_STAGES = ["Prospect", "Treino experimental agendado"];
const LEAD_STAGE = "Novo lead";

const TIPO_META: Record<Tipo, { label: string; className: string; group: string }> = {
  lead: { label: "Lead", className: "status-info", group: "Leads" },
  prospect: { label: "Prospect", className: "status-warning", group: "Prospects" },
  ativo: { label: "Ativo", className: "status-active", group: "Alunos Ativos" },
  inativo: { label: "Inativo", className: "status-urgent", group: "Alunos Inativos" },
};

export function GlobalCadastroSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(term, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: stages = [] } = useQuery({
    queryKey: ["all-pipeline-stages-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id,name");
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const stageMap = useMemo(() => {
    const m: Record<string, string> = {};
    stages.forEach((s: any) => { m[s.id] = s.name; });
    return m;
  }, [stages]);

  const { data: alunos = [], isFetching } = useQuery({
    queryKey: ["global-search-cadastros", debounced],
    queryFn: async () => {
      const t = debounced.trim();
      if (t.length < 2) return [] as any[];
      const { data, error } = await supabase.rpc("search_cadastros", { termo: t });
      if (error) throw error;
      return data || [];
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    const out: Record<Tipo, Resultado[]> = { lead: [], prospect: [], ativo: [], inativo: [] };
    alunos.forEach((a: any) => {
      const stageName = a.current_pipeline_stage_id ? stageMap[a.current_pipeline_stage_id] : null;
      let tipo: Tipo;
      if (stageName === LEAD_STAGE) tipo = "lead";
      else if (stageName && PROSPECT_STAGES.includes(stageName)) tipo = "prospect";
      else if (a.status === "encerrado" || a.status === "inativo") tipo = "inativo";
      else tipo = "ativo";
      if (out[tipo].length < 8) {
        out[tipo].push({ id: a.id, nome: a.nome, telefone: a.telefone, tipo });
      }
    });
    return out;
  }, [alunos, stageMap]);

  const totalResultados = grouped.lead.length + grouped.prospect.length + grouped.ativo.length + grouped.inativo.length;

  function handleSelect(r: Resultado) {
    setOpen(false);
    setTerm("");
    if (r.tipo === "ativo" || r.tipo === "inativo") {
      navigate(`/alunos/${r.id}`);
    } else if (r.tipo === "lead") {
      navigate(`/leads?edit=${r.id}`);
    } else {
      navigate(`/prospects?edit=${r.id}`);
    }
  }

  const showPopover = open && debounced.trim().length >= 2;

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={term}
            onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar aluno…    ⌘K"
            className="pl-8 h-9"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[480px] p-0 max-h-[60vh] overflow-y-auto"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isFetching && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">Buscando…</div>
        )}
        {!isFetching && totalResultados === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum cadastro encontrado.</div>
        )}
        {!isFetching && totalResultados > 0 && (
          <div className="py-1">
            {(Object.keys(grouped) as Tipo[]).map((tipo) => {
              const items = grouped[tipo];
              if (!items.length) return null;
              const meta = TIPO_META[tipo];
              return (
                <div key={tipo} className="py-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {meta.group} ({items.length})
                  </div>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-secondary/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.telefone || "—"}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
