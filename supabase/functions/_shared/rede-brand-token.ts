// ─────────────────────────────────────────────────────────────
// Interpretação do `brand.tokenStatus` devolvido pela Rede e guardado
// em `rede_tokenizacoes.raw_response`.
//
// A Rede responde `tokenizationStatus: "Active"` mesmo quando a BANDEIRA
// recusa gerar o token — nesse caso `brand.tokenStatus` vem como
// "Unavailable" (bandeira não habilitada/indisponível) ou "Deleted"
// (token removido). Sem `token.code` não há como cobrar, e o registro
// fica "pending" para sempre. Isso NÃO é lentidão: é recusa definitiva.
// ─────────────────────────────────────────────────────────────

/** Status da bandeira que significam "ainda processando" — vale esperar. */
const EM_PROCESSAMENTO = new Set([
  "",
  "pending",
  "processing",
  "inprogress",
  "in_progress",
  "requested",
  "created",
  "new",
  "waiting",
]);

/** Status da bandeira que significam sucesso. */
const ATIVO = new Set(["active", "activated"]);

export function extrairBrandTokenStatus(raw: unknown): string {
  const brand = (raw as any)?.brand;
  return String(brand?.tokenStatus ?? "").trim();
}

/**
 * `true` quando a bandeira já deu uma resposta definitiva de recusa.
 * Ausência de resposta ou status de processamento retornam `false`
 * (mantém o comportamento de timeout genérico).
 */
export function bandeiraRecusouToken(raw: unknown): boolean {
  if (raw == null) return false;
  const status = extrairBrandTokenStatus(raw).toLowerCase();
  if (EM_PROCESSAMENTO.has(status)) return false;
  if (ATIVO.has(status)) return false;
  return true;
}

/**
 * Status final exposto ao frontend. Recebe o status persistido e o
 * `raw_response`; só converte "pending" em "recusado_bandeira".
 */
export function resolverStatusTokenizacao(
  statusPersistido: string | null | undefined,
  raw: unknown,
): string {
  const status = String(statusPersistido ?? "").toLowerCase();
  if (status === "pending" && bandeiraRecusouToken(raw)) return "recusado_bandeira";
  return status || "pending";
}
