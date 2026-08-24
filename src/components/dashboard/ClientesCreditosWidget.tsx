import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { creditoAtivo, creditoDisponivel } from "@/lib/creditos-calc";

interface Props {
  /** Atividades de crédito a exibir. Vazio/omitido = todas. */
  atividades?: string[];
}

interface Linha {
  id: string;
  alunoId: string;
  nome: string;
  atividade: string;
  restante: number;
  ilimitado: boolean;
}

export function ClientesCreditosWidget({ atividades }: Props) {
  const navigate = useNavigate();
  const filtro = atividades && atividades.length ? atividades : null;

  const { data = [] } = useQuery({
    queryKey: ["dashboard-clientes-creditos", filtro?.join(",") ?? "todas"],
    queryFn: async (): Promise<Linha[]> => {
      let q = supabase
        .from("creditos_aluno")
        .select("id, aluno_id, atividade, quantidade_inicial, quantidade_usada, ilimitado, data_validade, ativo, alunos(nome)")
        .eq("ativo", true);
      if (filtro) q = q.in("atividade", filtro);
      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as any[])
        .filter((c) => creditoAtivo(c))
        .map((c) => {
          const disp = creditoDisponivel(c);
          return {
            id: c.id as string,
            alunoId: c.aluno_id as string,
            nome: (c.alunos?.nome as string) || "Cliente",
            atividade: c.atividade as string,
            restante: Number.isFinite(disp) ? disp : 0,
            ilimitado: c.ilimitado === true,
          };
        })
        .filter((l) => l.ilimitado || l.restante > 0)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
    staleTime: 60_000,
  });

  const totalClientes = new Set(data.map((l) => l.alunoId)).size;

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Ticket className="w-4 h-4 text-primary" />
          Clientes com créditos disponíveis
        </h3>
        <span className="text-xs text-muted-foreground">{totalClientes} cliente(s)</span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente com crédito disponível</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {data.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/alunos/${l.alunoId}`)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm text-foreground truncate">{l.nome}</span>
                <span className="block text-[11px] text-muted-foreground">{l.atividade}</span>
              </span>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                {l.ilimitado ? "ilimitado" : l.restante}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
