import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardData {
  alunos: { ativos: number; agregadores: number; vip: number; licenca: number };
  tarefas: { pendentes: number; atrasadas: number };
  agenda: { avaliacoes_hoje: number; experimentais_hoje: number };
  aniversariantes: {
    today: { id: string; nome: string; dia: number }[];
    month: { id: string; nome: string; dia: number }[];
  };
}

/**
 * Consolidated dashboard data — single RPC call replaces 4+ separate queries.
 * Cached for 60s to avoid re-fetching on every navigation.
 */
export function useDashboardData(professorId: string | null) {
  return useQuery({
    queryKey: ["dashboard-data", professorId],
    queryFn: async (): Promise<DashboardData> => {
      const { data, error } = await supabase.rpc("get_dashboard_data", {
        _professor_id: professorId,
      });
      if (error) throw error;
      return data as unknown as DashboardData;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
