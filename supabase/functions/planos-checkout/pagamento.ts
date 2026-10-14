// Pagamento do checkout /planos 2027 (Pix à vista e cartão até 12x).
// Valor, parcelas e modo (simulação/real) vêm sempre de fn_checkout_2027_pagamento_iniciar.
// Em simulação nada chama Inter nem Rede e nada é gravado em tabelas financeiras.
// Nunca registra CPF nem dados de cartão.

export type Tentativa = {
  id: string; tipo: "pix" | "cartao"; simulado: boolean; valor_centavos: number; total_proposta_centavos: number;
  parcelas: number; status: "pendente" | "aprovado" | "recusado" | "expirado" | "processando" | "desconhecido"; expira_em: string | null; motivo: string | null;
  reutilizada?: boolean; em_andamento?: boolean;
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
/** Resposta pública da tentativa: nunca expõe ref/txid nem motivo interno; cartão ganha só a fase. */
export function tentativaPublica(t: Tentativa | null) {
  if (!t) return null;
  const { id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, status, expira_em } = t;
  const fase = status === "desconhecido" ? "confirmando" : status === "processando" ? (t.motivo === "cobrando" ? "cobrando" : "validando") : null;
  return { id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, status, expira_em, fase };
}

/** Validade da cobrança Pix do /planos (calendario.expiracao) e margem antes de reaproveitar. */
export const PIX_EXPIRACAO_S = 1800;
export const PIX_MARGEM_S = 60;
/** Cobrança só é reaproveitada se ainda ativa e dentro da validade com margem. */
export function cobrancaValida(cob: { status: string; created_at: string } | null, agora = Date.now()): boolean {
  if (!cob || !["CRIADA", "ATIVA"].includes(cob.status)) return false;
  const criada = Date.parse(cob.created_at);
  return Number.isFinite(criada) && agora - criada < (PIX_EXPIRACAO_S - PIX_MARGEM_S) * 1000;
}

/** Consultas da tela (polling) têm cota própria: por proposta e IP generoso; o resto segue 120/h por IP. */
export const ACOES_CONSULTA = new Set(["status_pagamento", "estado", "status_cartao"]);
export function chavesLimite(acao: unknown, ip: string, propostaId: string): { chave: string; limite: number }[] {
  if (typeof acao === "string" && ACOES_CONSULTA.has(acao)) {
    return [{ chave: `ckc:p:${propostaId}`, limite: 600 }, ...(ip ? [{ chave: `ckc:i:${ip}`, limite: 20000 }] : [])];
  }
  if ((acao === "pagar_cartao" || acao === "tokenizar_cartao") && ip) return [{ chave: `ckf:i:${ip}`, limite: 120 }, { chave: `ckcard:i:${ip}`, limite: 10 }];
  return ip ? [{ chave: `ckf:i:${ip}`, limite: 120 }] : [];
}

/** Grava a cobrança com uma nova tentativa em caso de erro. Retorna true se gravou. */
export async function gravarComRetentativa(gravar: () => Promise<{ error: unknown }>): Promise<boolean> {
  for (let i = 0; i < 2; i++) {
    try { const { error } = await gravar(); if (!error) return true; } catch { /* tenta de novo */ }
  }
  return false;
}

/** Espelha fn_checkout_2027_cartao_elegivel: plano no cartão até 12x com consultas juntas (ou sem), ou consultas sozinhas até 6x. */
export function cartaoRealElegivel(c: Record<string, any>): boolean {
  if (c?.forma_plano === "cartao_parcelado")
    return Number(c.parcelas_plano) >= 1 && Number(c.parcelas_plano) <= 12 && (!Number(c.servicos_centavos) || c.forma_servicos == null);
  if (c?.forma_plano == null) return c?.forma_servicos === "cartao_parcelado" && Number(c.parcelas_servicos) >= 1 && Number(c.parcelas_servicos) <= 6;
  return false;
}

/** Ações que criam ou combinam cobrança: bloqueadas para propostas com consultas (site vende só o plano). */
export const ACOES_COBRANCA = new Set(["cartao_combinar", "pagar_pix", "tokenizar_cartao", "pagar_cartao"]);
export function temConsultas(v: unknown): boolean {
  return Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim() !== "");
}
