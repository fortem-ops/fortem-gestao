import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Contadores do menu lateral: tarefas atrasadas e automáticas em aberto
 * do próprio usuário logado.
 */
export function useTarefasBadge() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tarefas-badge", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!user) return { atrasadas: 0, automaticas: 0 };
      const hoje = new Date().toISOString().split("T")[0];

      const [atrasadasRes, automaticasRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", user.id)
          .neq("status", "concluida")
          .lt("data_limite", hoje),
        supabase
          .from("tarefas")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", user.id)
          .neq("status", "concluida")
          .eq("automatica", true),
      ]);

      return {
        atrasadas: atrasadasRes.count ?? 0,
        automaticas: automaticasRes.count ?? 0,
      };
    },
  });
}
