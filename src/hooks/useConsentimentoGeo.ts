import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTermoVigente } from "@/hooks/useTermoVigente";

export interface ConsentimentoGeo {
  aceito: boolean;
  aceito_em: string;
  versao_termo: string;
}

export function useConsentimentoGeo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { termo } = useTermoVigente();

  const query = useQuery({
    queryKey: ["ponto-consentimento-geo", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ConsentimentoGeo | null> => {
      const { data, error } = await supabase
        .from("ponto_consentimento_geo")
        .select("aceito, aceito_em, versao_termo")
        .eq("usuario_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (aceito: boolean) => {
      if (!user) throw new Error("Usuário não autenticado");
      const versao = termo?.versao ?? "1.1";
      const texto = termo?.texto_termo ?? "";
      const { error } = await supabase
        .from("ponto_consentimento_geo")
        .upsert(
          {
            usuario_id: user.id,
            aceito,
            aceito_em: new Date().toISOString(),
            user_agent:
              typeof navigator !== "undefined"
                ? navigator.userAgent.slice(0, 500)
                : null,
            versao_termo: versao,
            texto_termo: texto,
          },
          { onConflict: "usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ponto-consentimento-geo", user?.id] });
    },
  });

  return {
    consentimento: query.data ?? null,
    loading: query.isLoading,
    registrar: (aceito: boolean) => mutation.mutateAsync(aceito),
    registrando: mutation.isPending,
    versaoVigente: termo?.versao ?? null,
  };
}
