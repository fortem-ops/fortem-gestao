import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TEXTO_TERMO_V1_1 = `A FORTEM utiliza sistema eletrônico de registro de ponto por navegador, com coleta de geolocalização exclusivamente no momento da marcação de entrada, saída e intervalos, com a finalidade de comprovar o local do registro de jornada. Não há rastreamento contínuo do colaborador. Quando o colaborador não desejar utilizar dispositivo próprio, a empresa disponibilizará equipamento no local de trabalho para realização da marcação. Os dados de localização são armazenados de forma segura e retidos por 5 anos, conforme obrigação legal trabalhista (Art. 11 da CLT). Base legal: Legítimo interesse do empregador (Art. 7º, IX da LGPD) e obrigação legal (Art. 7º, II da LGPD). Versão 1.1.`;

export interface ConsentimentoGeo {
  aceito: boolean;
  aceito_em: string;
  versao_termo: string;
}

export function useConsentimentoGeo() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
            versao_termo: "1.0",
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
  };
}
