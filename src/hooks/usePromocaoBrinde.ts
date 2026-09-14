import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromocaoBrinde {
  id: string;
  ativo: boolean;
  valor_minimo: number;
  data_fim: string;
  brinde_1_nome: string;
  brinde_1_imagem_url: string | null;
  brinde_2_nome: string;
  brinde_2_imagem_url: string | null;
}

export const brindeVigente = (config?: PromocaoBrinde | null): boolean => {
  if (!config?.ativo || !config.data_fim) return false;
  const [ano, mes, dia] = config.data_fim.split("-").map(Number);
  // Campanha vale até o fim do dia informado.
  return Date.now() <= new Date(ano, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59).getTime();
};

export const formatarDataFim = (data: string): string => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1).toLocaleDateString("pt-BR");
};

export const usePromocaoBrinde = () =>
  useQuery({
    queryKey: ["loja-promocao-brinde"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_promocao_brinde")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as PromocaoBrinde | null) ?? null;
    },
  });
