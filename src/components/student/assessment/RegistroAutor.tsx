import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RegistroAutor({ userId }: { userId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["registro-autor", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return <p className="text-xs text-muted-foreground mt-1">Registrado por: {isLoading ? "Carregando…" : data?.full_name ?? "Profissional não identificado"}</p>;
}