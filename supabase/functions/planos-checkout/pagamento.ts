// Pagamento do checkout /planos 2027 (Pix à vista e cartão até 12x).
// Valor, parcelas e modo (simulação/real) vêm sempre de fn_checkout_2027_pagamento_iniciar.
// Em simulação nada chama Inter nem Rede e nada é gravado em tabelas financeiras.
// Nunca registra CPF nem dados de cartão.

export type Tentativa = {
  id: string; tipo: "pix" | "cartao"; simulado: boolean; valor_centavos: number; total_proposta_centavos: number;
  parcelas: number; status: "pendente" | "aprovado" | "recusado" | "expirado"; expira_em: string | null; motivo: string | null;
  reutilizada?: boolean;
};

/** Resultado aceito no cartão simulado; qualquer outro valor vira recusa. */
export function resultadoCartaoSimulado(v: unknown): "aprovado" | "recusado" {
  return v === "aprovado" ? "aprovado" : "recusado";
}
/** Resultado aceito na simulação do Pix. */
export function resultadoPixSimulado(v: unknown): "aprovado" | "expirado" | null {
  return v === "aprovado" || v === "expirado" ? v : null;
}
/** Status do Inter (/cob) para a tentativa. */
export function statusInterParaTentativa(s: unknown): Tentativa["status"] | null {
  if (s === "CONCLUIDA") return "aprovado";
  if (s === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || s === "REMOVIDA_PELO_PSP") return "expirado";
  return null;
}
/** Resposta pública da tentativa: nunca expõe ref/txid de provedor. */
export function tentativaPublica(t: Tentativa | null) {
  if (!t) return null;
  const { id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, status, expira_em } = t;
  return { id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, status, expira_em };
}
