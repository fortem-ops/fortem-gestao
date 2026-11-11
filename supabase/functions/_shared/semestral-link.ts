/** Regras do link público de pagamento do Plano Semestral (1ª mensalidade). */
export const JANELA_HUMANO_MS = 2 * 60 * 60 * 1000;

/** Venda desistida, expirada ou estornada: o link não vale mais. */
export function vendaEncerrada(status: string | null | undefined): boolean {
  return ["cancelado", "estornado", "falha"].includes(String(status ?? ""));
}

/** Com o Turnstile ligado, a cobrança exige verificação aprovada no link nas últimas 2 horas. */
export function humanoValido(humanoEm: string | null | undefined, turnstileAtivo: boolean, agora = Date.now()): boolean {
  if (!turnstileAtivo) return true;
  if (!humanoEm) return false;
  const t = new Date(humanoEm).getTime();
  return Number.isFinite(t) && t <= agora && agora - t <= JANELA_HUMANO_MS;
}
