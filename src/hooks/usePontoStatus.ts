import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PontoEstado } from "@/lib/ponto";

export function usePontoStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ponto-status-sidebar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_estado_atual", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return (data as any)?.status as PontoEstado | null;
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
