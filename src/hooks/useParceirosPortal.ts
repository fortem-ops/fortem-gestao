import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  montarParceirosAtivosComBeneficios,
  type BeneficioParceiroRow,
  type ParceiroComBeneficios,
  type ParceiroPublicoRow,
} from "@/lib/portalReorganizacao";

export function useParceirosPortal(enabled = true) {
  return useQuery<ParceiroComBeneficios[]>({
    queryKey: ["portal-parceiros-ativos"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [resParceiros, resBeneficios] = await Promise.all([
        supabase
          .from("parceiros_publico")
          .select("id, nome, categoria, descricao, logo_url, ativo")
          .eq("ativo", true),
        supabase
          .from("beneficios")
          .select("id, parceiro_id, titulo, regra_uso, ativo")
          .eq("ativo", true),
      ]);
      if (resParceiros.error) throw resParceiros.error;
      if (resBeneficios.error) throw resBeneficios.error;
      return montarParceirosAtivosComBeneficios(
        (resParceiros.data ?? []) as ParceiroPublicoRow[],
        (resBeneficios.data ?? []) as BeneficioParceiroRow[],
      );
    },
  });
}