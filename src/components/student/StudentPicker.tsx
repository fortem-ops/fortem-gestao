import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


const STATUS_SUFIXO: Record<string, string> = {
  licenca: "licença",
  avulso: "cliente avulso",
  inativo: "inativo",
  cancelado: "cancelado",
  lead: "lead",
  prospect: "prospect",
};

function statusSufixo(status: string) {
  return STATUS_SUFIXO[status] ?? status;
}

interface StudentPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  /** Inclui um grupo "Equipe" com as fichas pessoais dos profissionais. */
  includeEquipe?: boolean;
  /** Lista TODOS os cadastros (ativos, licença, inativos, leads e clientes avulsos). */
  includeTodos?: boolean;
}

export function StudentPicker({ value, onChange, label = "Aluno", placeholder = "Buscar aluno pelo nome...", includeEquipe = false, includeTodos = false }: StudentPickerProps) {
  const [open, setOpen] = useState(false);
  const [resolvingEquipe, setResolvingEquipe] = useState(false);
  const [equipeSelecionada, setEquipeSelecionada] = useState<{ id: string; nome: string } | null>(null);

  const { data: equipe = [] } = useQuery({
    queryKey: ["equipe-fichas-picker"],
    enabled: includeEquipe,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (n: string) => Promise<{ data: { user_id: string; nome: string }[] | null; error: unknown }>
      )("fn_listar_equipe_fichas");
      if (error) throw error;
      return data || [];
    },
  });


  const { data: stagesMap = {} } = useQuery({
    queryKey: ["pipeline-stages-map-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id, name");
      const m: Record<string, string> = {};
      (data || []).forEach((s: any) => { m[s.id] = s.name; });
      return m;
    },
    staleTime: 5 * 60_000,
  });

  const FUNIL_STAGES = ["Novo lead", "Prospect", "Treino experimental agendado"];

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["alunos-picker", includeTodos ? "todos" : "ativos-licenca", Object.keys(stagesMap).length],
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      // Paginação para contornar o limite padrão de 1000 linhas do PostgREST
      // + filtro server-side por status para evitar trazer leads/prospects/inativos.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("alunos")
          .select("id, nome, status, current_pipeline_stage_id")
          .eq("is_equipe", false);
        if (!includeTodos) q = q.in("status", ["ativo", "licenca"]);
        const { data, error } = await q.order("nome").range(from, from + PAGE - 1);

        if (error) throw error;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (includeTodos) return all;
      return all.filter((a: any) => {
        const stageName = a.current_pipeline_stage_id ? stagesMap[a.current_pipeline_stage_id] : null;
        if (stageName && FUNIL_STAGES.includes(stageName)) return false;
        return true;
      });
    },
  });

  const selected = alunos.find((a) => a.id === value);
  const selectedLabel = selected?.nome ?? (equipeSelecionada?.id === value ? equipeSelecionada.nome : null);

  async function handleSelectEquipe(userId: string, nome: string) {
    setResolvingEquipe(true);
    try {
      const { data, error } = await (
        supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }>
      )("fn_get_or_create_ficha_equipe_de", { _user_id: userId });
      if (error) throw error;
      if (!data) throw new Error("Não foi possível abrir a ficha do profissional.");
      setEquipeSelecionada({ id: data, nome });
      onChange(data);
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Erro ao selecionar profissional.");
    } finally {
      setResolvingEquipe(false);
    }
  }


  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className="w-full md:w-96 justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              {selectedLabel ? (
                <span className="truncate">
                  {selectedLabel}
                  {selected?.status && selected.status !== "ativo" && (
                    <span className="text-xs text-muted-foreground ml-1">({statusSufixo(selected.status)})</span>
                  )}
                  {!selected && equipeSelecionada?.id === value && (
                    <span className="text-xs text-muted-foreground ml-1">(equipe)</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}

            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(value, search) => {
              // value here is the CommandItem's `value` prop (we'll set it to the nome)
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Digite para buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup heading={includeEquipe ? "Alunos" : undefined}>
                {alunos.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.nome}
                    onSelect={() => {
                      onChange(a.id);
                      setEquipeSelecionada(null);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === a.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{a.nome}</span>
                    {a.status && a.status !== "ativo" && (
                      <span className="text-xs text-muted-foreground ml-2">({statusSufixo(a.status)})</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {includeEquipe && equipe.length > 0 && (
                <CommandGroup heading="Equipe">
                  {equipe.map((p) => (
                    <CommandItem
                      key={p.user_id}
                      value={p.nome}
                      disabled={resolvingEquipe}
                      onSelect={() => handleSelectEquipe(p.user_id, p.nome)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          equipeSelecionada?.id === value && equipeSelecionada?.nome === p.nome
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="flex-1">{p.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">Equipe</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>

      </Popover>
    </div>
  );
}
