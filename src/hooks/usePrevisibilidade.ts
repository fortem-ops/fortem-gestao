import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Num = number | string | null;

export interface KpisPrevisibilidade {
  mes_atual_bruto: Num;
  mes_atual_liquido: Num;
  proximos_30_liquido: Num;
  proximos_60_liquido: Num;
  proximos_90_liquido: Num;
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

export function useKpisPrevisibilidade() {
  return useQuery({
    queryKey: ["previsibilidade-kpis"],
    queryFn: async () => {
      const { data, error } = await rpc("fn_previsibilidade_kpis");
      if (error) throw error;
      return ((data ?? []) as KpisPrevisibilidade[])[0] ?? undefined;
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

export interface RecebivelRow {
  id: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  origem: OrigemPrevisibilidade;
  descricao: string | null;
  forma_pagamento: string | null;
  bandeira: string | null;
  valor_bruto: Num;
  taxa_percentual: Num;
  valor_liquido: Num;
  data_vencimento: string | null;
  data_recebimento_prevista: string | null;
  bandeira_de_cartao_salvo?: boolean | null;
}

export function useRecebiveisPrevistos() {
  return useQuery({
    queryKey: ["previsibilidade-recebiveis"],
    queryFn: async () => {
      const PAGE = 1000;
      const todas: RecebivelRow[] = [];
      for (let from = 0; ; from += PAGE) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from as any)("vw_recebiveis_previstos_todos")
          .select("*")
          .order("data_recebimento_prevista", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as RecebivelRow[];
        todas.push(...rows);
        if (rows.length < PAGE) break;
      }
      return todas;
    },
  });
}

export interface ContratoVencendoRow {
  contrato_id: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  plano_tipo: string | null;
  valor_cobrado: Num;
  data_fim: string | null;
  dias_restantes: number | null;
  renovacao_automatica: boolean | null;
}

export function useContratosVencendo() {
  return useQuery({
    queryKey: ["previsibilidade-contratos-vencendo"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("vw_contratos_vencendo").select("*").order("data_fim");
      if (error) throw error;
      return (data ?? []) as ContratoVencendoRow[];
    },
  });
}
