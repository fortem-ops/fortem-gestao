import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const uid = user!.id;

      const [{ data: admin }, { data: coordAdmin }, { data: parceiro }] = await Promise.all([
        supabase.rpc("is_admin", { _user_id: uid }),
        supabase.rpc("is_coordinator_or_admin", { _user_id: uid }),
        supabase.from("parceiros").select("id").eq("user_id", uid).eq("ativo", true).maybeSingle(),
      ]);

      return {
        isAdmin: !!admin,
        isCoordAdmin: !!coordAdmin,
        isParceiro: !!parceiro,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}
