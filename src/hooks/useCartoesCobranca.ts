import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cartões salvos elegíveis para a cobrança de um clique.
 * Lidos pela RPC fn_cartoes_cobraveis (só admin). O frontend NUNCA
 * consulta rede_tokenizacoes nem recebe token_rede/tokenization_id.
 */
export interface CartaoCobravel {
  id: string;
  brand: string | null;
  last4: string | null;
  expiration_month: number | null;
  expiration_year: number | null;
  is_default: boolean;
  apto: boolean;
  motivo_inapto: string | null;
}

export function useCartoesCobranca(alunoId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["cartoes-cobraveis", alunoId],
    enabled: !!alunoId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<CartaoCobravel[]> => {
      const { data, error } = await supabase.rpc("fn_cartoes_cobraveis", {
        p_aluno_id: alunoId!,
      });
      if (error) throw error;
      const linhas = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
      return linhas.map((r) => ({
        id: String(r.id),
        brand: (r.brand as string) ?? null,
        last4: (r.last4 as string) ?? null,
        expiration_month: r.expiration_month == null ? null : Number(r.expiration_month),
        expiration_year: r.expiration_year == null ? null : Number(r.expiration_year),
        is_default: !!r.is_default,
        apto: !!r.apto,
        motivo_inapto: (r.motivo_inapto as string) ?? null,
      }));
    },
  });
}

export interface CobrarSalvoResposta {
  success?: boolean;
  incerto?: boolean;
  em_processamento?: boolean;
  idempotente?: boolean;
  aviso?: string | null;
  tid?: string | null;
  valor_centavos?: number | null;
  brand?: string | null;
  last4?: string | null;
  motivo?: string | null;
  error?: string | null;
}

/** Mesma abordagem por prefixo usada em useEstorno.ts. */
export const PREFIXOS_PAGAMENTOS = [
  "vendas",
  "vendas-aluno",
  "vendas-planos-contratos",
  "historico-vendas",
  "cobrancas",
  "cobrancas-contrato",
  "contratos",
  "contratos-aluno",
  "ciclo-ativo",
  "inadimplencias",
  "inadimplencias-contrato",
  "inadimplencias-aluno",
  "pagamentos-aluno",
  "cartoes-cobraveis",
  "estornos-contrato",
];

export function invalidarPagamentos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({
    refetchType: "all",
    predicate: (q) =>
      typeof q.queryKey[0] === "string" && PREFIXOS_PAGAMENTOS.includes(q.queryKey[0] as string),
  });
}

/**
 * Cobrança de um clique com cartão salvo. O cliente envia apenas
 * venda_id, cartao_id, installments e idempotency_key — valor e token
 * vêm do servidor.
 */
export function useCobrarCartaoSalvo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vendaId: string;
      cartaoId: string;
      installments: number;
      idempotencyKey: string;
    }): Promise<CobrarSalvoResposta> => {
      const { data, error } = await supabase.functions.invoke("rede-cobrar-salvo", {
        body: {
          venda_id: input.vendaId,
          cartao_id: input.cartaoId,
          installments: input.installments,
          idempotency_key: input.idempotencyKey,
        },
      });

      if (error) {
        // Erros HTTP (401/403/429/400/409/502) trazem o corpo JSON no contexto.
        let corpo: CobrarSalvoResposta | null = null;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") corpo = await ctx.json();
        } catch { /* mantém a mensagem original */ }
        if (corpo) return { ...corpo, success: false };
        return { success: false, error: error.message };
      }
      return (data ?? {}) as CobrarSalvoResposta;
    },
    onSuccess: (resposta) => {
      if (resposta?.success) invalidarPagamentos(qc);
    },
  });
}
