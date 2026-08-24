import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserRoles } from "@/hooks/useUserRoles";
import AddClienteAvulsoDialog from "@/components/student/AddClienteAvulsoDialog";


interface ClienteAvulso {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  created_at: string | null;
}

export default function ClientesAvulsos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: roles } = useUserRoles();
  const canCreate = !!roles?.isCoordAdmin || !!roles?.isNutriFisio;
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 250).trim().toLowerCase();


  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes-avulsos"],
    queryFn: async (): Promise<ClienteAvulso[]> => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email, telefone, cidade, created_at")
        .eq("status", "avulso")
        .order("nome");
      if (error) throw error;
      return (data || []) as ClienteAvulso[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!term) return clientes;
    return clientes.filter(
      (c) =>
        (c.nome ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.telefone ?? "").toLowerCase().includes(term),
    );
  }, [clientes, term]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Clientes Avulsos</h1>
        <p className="text-sm text-muted-foreground">
          Clientes que usam apenas serviços pontuais, sem vínculo de assessoria ou plano de treino.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone…"
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente avulso encontrado.
        </div>
      ) : (
        <div className="glass-card divide-y divide-border overflow-hidden">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/alunos/${c.id}`)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-secondary/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.email, c.telefone, c.cidade].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] status-info shrink-0">
                Avulso
              </Badge>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} cliente{filtered.length === 1 ? "" : "s"} avulso{filtered.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
