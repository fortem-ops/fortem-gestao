import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TermoVigente {
  id: string;
  versao: string;
  titulo: string | null;
  texto_termo: string;
  vigente_desde: string;
}

const FALLBACK_TEXTO =
  "A FORTEM utiliza sistema eletrônico de registro de ponto por navegador, com coleta de geolocalização exclusivamente no momento da marcação de entrada, saída e intervalos, com a finalidade de comprovar o local do registro de jornada. Não há rastreamento contínuo do colaborador. Quando o colaborador não desejar utilizar dispositivo próprio, a empresa disponibilizará equipamento no local de trabalho para realização da marcação. Os dados de localização são armazenados de forma segura e retidos por 5 anos, conforme obrigação legal trabalhista (Art. 11 da CLT). Base legal: Legítimo interesse do empregador (Art. 7º, IX da LGPD) e obrigação legal (Art. 7º, II da LGPD). Versão 1.1.";

export function useTermoVigente() {
  const query = useQuery({
    queryKey: ["ponto-termo-vigente"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TermoVigente> => {
      const { data, error } = await supabase
        .from("ponto_politica_retencao" as any)
        .select("id, versao, titulo, texto_termo, vigente_desde")
        .eq("vigente", true)
        .maybeSingle();
      if (error) throw error;
      const row = data as any;
      if (row?.versao && row?.texto_termo) {
        return row as TermoVigente;
      }
      return {
        id: "fallback",
        versao: "1.1",
        titulo: "Termo de Consentimento de Geolocalização",
        texto_termo: FALLBACK_TEXTO,
        vigente_desde: new Date().toISOString(),
      };
    },
  });

  return {
    termo: query.data ?? null,
    loading: query.isLoading,
  };
}
