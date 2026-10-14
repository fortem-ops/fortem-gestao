/** Qual bloco o passo de pagamento do /planos mostra. Decisão vem do servidor (cartao_*), a tela só escolhe a apresentação. */
export type ModoPagamentoTela = "pix" | "combinar" | "recorrencia_previa" | "cartao" | "reservado";

export function modoPagamentoTela(
  formaPlano: string | null | undefined,
  p: { cartao_a_combinar?: boolean; cartao_real?: boolean; cartao_simulado?: boolean },
): ModoPagamentoTela {
  if (formaPlano === "pix_vista") return "pix";
  if (p.cartao_a_combinar === true) return "combinar";
  // Recorrência no cartão: cobrança real só a partir da R3; aqui só simulação/prévia admin.
  if (formaPlano === "recorrencia") return p.cartao_simulado === true ? "recorrencia_previa" : "combinar";
  if (p.cartao_real === true || p.cartao_simulado === true) return "cartao";
  return "reservado";
}
