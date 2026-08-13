import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";

type Tipo = "lead" | "prospect" | "ativo" | "avulso" | "inativo" | "cancelado" | "pausado" | "licenca";

interface Resultado {
  id: string;
  nome: string;
  telefone: string | null;
  tipo: Tipo;
}

const TIPO_META: Record<Tipo, { label: string; className: string; group: string }> = {
  lead: { label: "Lead", className: "status-info", group: "Leads" },
  prospect: { label: "Prospect", className: "status-warning", group: "Prospects" },
  ativo: { label: "Ativo", className: "status-active", group: "Alunos Ativos" },
  avulso: { label: "Avulso", className: "status-info", group: "Clientes Avulsos" },
  inativo: { label: "Inativo", className: "status-urgent", group: "Alunos Inativos" },
  cancelado: { label: "Cancelado", className: "status-urgent", group: "Cancelados" },
  pausado: { label: "Pausado", className: "status-warning", group: "Pausados" },
  licenca: { label: "Licença", className: "status-license", group: "Em Licença" },
};

const ORDEM: Tipo[] = ["ativo", "prospect", "lead", "avulso", "licenca", "pausado", "inativo", "cancelado"];

function mapStatus(status: string | null | undefined): Tipo {
  switch (status) {
    case "lead":
    case "prospect":
    case "avulso":
    case "cancelado":
    case "pausado":
    case "licenca":
    case "inativo":
    case "ativo":
      return status;
    case "encerrado":
      return "inativo";
    default:
      return "inativo";
  }
}


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
    const out = ORDEM.reduce((acc, t) => { acc[t] = []; return acc; }, {} as Record<Tipo, Resultado[]>);
    alunos.forEach((a: any) => {
      const tipo = mapStatus(a.status);
      if (out[tipo].length < 8) {
        out[tipo].push({ id: a.id, nome: a.nome, telefone: a.telefone, tipo });
      }
    });
    return out;
  }, [alunos]);

  const totalResultados = ORDEM.reduce((n, t) => n + grouped[t].length, 0);


  function handleSelect(r: Resultado) {
    setOpen(false);
    setTerm("");
    if (r.tipo === "lead") {
      navigate(`/leads?edit=${r.id}`);
    } else if (r.tipo === "prospect") {
      navigate(`/prospects?edit=${r.id}`);
    } else {
      navigate(`/alunos/${r.id}`);
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
            {ORDEM.map((tipo) => {
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
