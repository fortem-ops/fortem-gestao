// ─────────────────────────────────────────────────────────────
// Pós-aprovação de uma venda paga no cartão.
//
// REGRA: este módulo é uma RELOCALIZAÇÃO do trecho que já existia em
// rede-cobrar-cartao/index.ts — atualização da venda, quitação das
// parcelas e criação de contrato (recorrência ou tradicional).
// A ordem das chamadas, os parâmetros e os logs são idênticos aos
// anteriores. Não alterar sem revisão — toca cobrança em produção.
// ─────────────────────────────────────────────────────────────

import { isRecorrencia as isVendaRecorrencia } from "./rede-payload.ts";

/** Cliente Supabase (service role) — tipagem mínima usada aqui. */
type Db = any;

/** Atualiza status da venda e, se aprovado, quita as parcelas pendentes. */
export async function atualizarVendaEParcelas(
  supabase: Db,
  vendaId: string,
  approved: boolean,
): Promise<void> {
  await supabase.from("vendas")
    .update({ status_pagamento: approved ? "pago" : "falha" })
    .eq("id", vendaId);

  if (approved) {
    const { data: pagamento } = await supabase
      .from("pagamentos").select("id").eq("venda_id", vendaId).maybeSingle();
    if (pagamento) {
      await supabase.from("pagamento_parcelas")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("pagamento_id", pagamento.id)
        .eq("status", "pendente");
    }
  }
}

export interface CriarContratoInput {
  vendaId: string;
  alunoId: string;
  /** Linha de `vendas` já carregada (valor, desconto, tipo_cobranca, taxa_mensal, catalogo_id, data_venda, parcelas). */
  venda: any;
  /** Cartão salvo vinculado ao contrato de recorrência (pode ser null). */
  cartaoTokenId: string | null;
  servicosInclusos: unknown;
  /** Forma registrada no contrato tradicional. */
  formaPagamentoTradicional?: string;
}

/**
 * Cria contrato + cobranças após aprovação — recorrência (1ª paga) ou
 * tradicional (todas pagas). Nunca lança: erros são registrados no console,
 * exatamente como no comportamento anterior.
 */
export async function criarContratoPosAprovacao(
  supabase: Db,
  input: CriarContratoInput,
): Promise<void> {
  const { vendaId, alunoId, venda, cartaoTokenId, servicosInclusos } = input;

  if (isVendaRecorrencia(venda as any)) {
    const periodoQ = await supabase.from("planos_catalogo")
      .select("periodo_meses").eq("id", (venda as any)?.catalogo_id).maybeSingle();
    const periodo = Math.max(1, Number((periodoQ.data as any)?.periodo_meses) || 1);
    const subtotal = Math.max(0, (Number((venda as any)?.valor) || 0) - (Number((venda as any)?.desconto) || 0));
    const valorMensal = subtotal / periodo;
    const { error: rpcErr } = await supabase.rpc("fn_criar_contrato_recorrencia", {
      p_venda_id: vendaId,
      p_aluno_id: alunoId,
      p_plano_id: (venda as any)?.catalogo_id,
      p_valor_mensal: valorMensal,
      p_taxa_mensal: Number((venda as any)?.taxa_mensal) || 0,
      p_data_inicio: (venda as any)?.data_venda ?? new Date().toISOString().split("T")[0],
      p_forma_pagamento: "cartao_recorrencia",
      p_cartao_token_id: cartaoTokenId,
      p_primeira_paga: true,
      p_servicos_inclusos: servicosInclusos,
    });
    if (rpcErr) console.error("[rede] fn_criar_contrato_recorrencia:", rpcErr.message);
    return;
  }

  const subtotal = Math.max(0, (Number((venda as any)?.valor) || 0) - (Number((venda as any)?.desconto) || 0));
  const { error: rpcTradErr } = await supabase.rpc("fn_criar_contrato_tradicional", {
    p_venda_id: vendaId,
    p_aluno_id: alunoId,
    p_plano_id: (venda as any)?.catalogo_id,
    p_valor_total: subtotal,
    p_parcelas: Number((venda as any)?.parcelas) || 1,
    p_forma_pagamento: input.formaPagamentoTradicional ?? "cartao_credito",
    p_data_inicio: (venda as any)?.data_venda ?? new Date().toISOString().split("T")[0],
    p_status_pagamento: "pago",
    p_servicos_inclusos: servicosInclusos,
  });
  if (rpcTradErr) console.error("[rede] fn_criar_contrato_tradicional:", rpcTradErr.message);
}
