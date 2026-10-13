const CHAVE = "fortem_checkout_2027_confirmacao";
/** Only identifiers; server acceptance must still be valid. Never financial status. */
export function guardarConfirmacao(proposta: string, aceite: string) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ proposta, aceite })); } catch { /* memory-only UI still works */ }
}
export function etapaReservada(etapa: string, proposta: string, aceite: string | null): "revisao" | "pagamento" | "confirmacao" {
  if (etapa === "aguardando_pagamento") return "confirmacao";
  if (etapa !== "contrato_aceito" || !aceite) return "revisao";
  try {
    const s = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null");
    if (s?.proposta === proposta && s?.aceite === aceite) return "confirmacao";
  } catch { /* no storage */ }
  return "pagamento";
}