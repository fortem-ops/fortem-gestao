import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { agoraSaoPaulo, tarefaAtrasada } from "@/lib/tarefaAtraso";

/**
 * Contadores do menu lateral: tarefas atrasadas e programadas em aberto
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
      if (!user) return { atrasadas: 0, programadas: 0 };

      const { data, error } = await supabase
        .from("tarefas")
        .select("data_limite, hora_limite, status")
        .eq("responsavel_id", user.id)
        .neq("status", "concluida");
      if (error) throw error;

      const agora = agoraSaoPaulo();
      let atrasadas = 0;
      let programadas = 0;
      (data || []).forEach((t) => {
        if (tarefaAtrasada(t.data_limite, t.hora_limite, agora)) atrasadas += 1;
        else if (t.status === "pendente") programadas += 1;
      });

      return { atrasadas, programadas };
    },
  });
}
