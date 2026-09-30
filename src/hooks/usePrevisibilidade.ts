import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Num = number | string | null;

export interface KpisPrevisibilidade {
  mes_atual_bruto: Num;
  mes_atual_liquido: Num;
  proximos_30_bruto: Num;
  proximos_60_bruto: Num;
  proximos_90_bruto: Num;
  em_atraso_bruto: Num;
  em_atraso_qtd: Num;
}

export type OrigemPrevisibilidade = "mensalidade" | "servico" | "produto";

export interface ResumoMensalRow {
  mes: string;
  origem: OrigemPrevisibilidade;
  qtd: Num;
  total_bruto: Num;
  total_liquido: Num;
}

export interface DiaADiaRow {
  dia: string;
  dia_util: boolean;
  previsto_bruto: Num;
  previsto_liquido: Num;
  realizado_bruto: Num;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export function useKpisPrevisibilidade() {
  return useQuery({
    queryKey: ["previsibilidade-kpis"],
    queryFn: async () => {
      const { data, error } = await rpc("fn_previsibilidade_kpis");
      if (error) throw error;
      return ((data ?? []) as KpisPrevisibilidade[])[0] ?? null;
    },
  });
}

export function useResumoMensalPrevisibilidade() {
  return useQuery({
    queryKey: ["previsibilidade-resumo-mensal"],
    queryFn: async () => {
      const { data, error } = await rpc("fn_previsibilidade_resumo_mensal");
      if (error) throw error;
      return (data ?? []) as ResumoMensalRow[];
    },
  });
}

export function useDiaADiaPrevisibilidade(inicio: string, fim: string) {
  return useQuery({
    queryKey: ["previsibilidade-dia-a-dia", inicio, fim],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await rpc("fn_previsibilidade_dia_a_dia", { p_inicio: inicio, p_fim: fim });
      if (error) throw error;
      return (data ?? []) as DiaADiaRow[];
    },
  });
}
