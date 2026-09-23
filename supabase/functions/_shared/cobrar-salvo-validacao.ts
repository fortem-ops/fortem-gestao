// ─────────────────────────────────────────────────────────────
// Validações da cobrança de um clique com cartão salvo.
// Puro (sem banco, sem rede) para ser testável isoladamente.
// ─────────────────────────────────────────────────────────────

export interface ValidacaoInput {
  venda: { id: string; aluno_id: string; status_pagamento?: string | null } | null | undefined;
  cartao: {
    id: string;
    aluno_id: string;
    ativo?: boolean | null;
    token_rede?: string | null;
    expiration_month: number | string;
    expiration_year: number | string;
  } | null | undefined;
  tokenizationId: string | null;
  pagamentoExistente?: { tid: string | null; status: string } | null;
  agora: Date;
}

export type ValidacaoResultado =
  | { ok: true }
  | { ok: false; codigo: string; motivo: string; tid?: string | null; statusExistente?: string | null };

/** Cartão vale até o último dia do mês de validade. */
export function cartaoVencido(mes: number | string, ano: number | string, agora: Date): boolean {
  const m = Number(mes), a = Number(ano);
  if (!Number.isFinite(m) || !Number.isFinite(a) || m < 1 || m > 12) return true;
  const limite = new Date(Date.UTC(a, m, 1)); // 1º dia do mês seguinte
  return agora.getTime() >= limite.getTime();
}

export function validarCobrancaSalvo(input: ValidacaoInput): ValidacaoResultado {
  const { venda, cartao, tokenizationId, pagamentoExistente, agora } = input;

  if (!venda) return { ok: false, codigo: "venda_inexistente", motivo: "Venda não encontrada" };
  if (venda.status_pagamento === "pago") {
    return { ok: false, codigo: "venda_paga", motivo: "Esta venda já está paga" };
  }
  if (pagamentoExistente) {
    return {
      ok: false,
      codigo: "ja_cobrada",
      motivo: "Já existe uma cobrança aprovada ou em processamento para esta venda",
      tid: pagamentoExistente.tid,
      statusExistente: pagamentoExistente.status ?? null,
    };
  }
  if (!cartao) return { ok: false, codigo: "cartao_inexistente", motivo: "Cartão não encontrado" };
  if (cartao.aluno_id !== venda.aluno_id) {
    return { ok: false, codigo: "cartao_outro_aluno", motivo: "Cartão não pertence a este aluno" };
  }
  if (!cartao.ativo) return { ok: false, codigo: "cartao_inativo", motivo: "Cartão inativo" };
  if (!cartao.token_rede) {
    return { ok: false, codigo: "sem_token", motivo: "Cartão sem token válido. É necessário recadastrar o cartão." };
  }
  if (cartaoVencido(cartao.expiration_month, cartao.expiration_year, agora)) {
    return { ok: false, codigo: "cartao_vencido", motivo: "Cartão vencido" };
  }
  if (!tokenizationId) {
    return { ok: false, codigo: "sem_tokenizacao", motivo: "Token de cobrança não encontrado para este cartão. É necessário recadastrar o cartão." };
  }
  return { ok: true };
}
