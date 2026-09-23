/**
 * Miolo compartilhado de estorno (refund) na Rede.
 * Extraído de `rede-cancelar` SEM alterar o comportamento dela:
 * mesma URL (`POST /transactions/{tid}/refunds`), mesmo corpo (`amount` em centavos)
 * e mesmos códigos de sucesso ("00", "359", "360").
 */

const REDE_URLS = {
  sandbox: "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};

/** Códigos que a Rede devolve para estorno bem-sucedido. */
export const REFUND_SUCCESS_CODES = ["00", "359", "360"];

export interface RedeSecrets {
  pv: string;
  token: string;
  ambiente: "sandbox" | "producao";
}

/** Lê PV/token/ambiente dos secrets de função, com fallback no Vault. */
// deno-lint-ignore no-explicit-any
export async function loadRedeSecrets(supabase: any): Promise<RedeSecrets> {
  const m: Record<string, string> = {};

  const envPv = Deno.env.get("REDE_PV") ?? "";
  const envToken = Deno.env.get("REDE_TOKEN") ?? "";
  const envAmbient = Deno.env.get("REDE_AMBIENTE") ?? "";

  if (envPv) m["rede_pv"] = envPv;
  if (envToken) m["rede_token"] = envToken;
  if (envAmbient) m["rede_ambiente"] = envAmbient;

  if (!(m["rede_pv"] && m["rede_token"])) {
    try {
      const { data, error } = await supabase
        .schema("vault")
        .from("decrypted_secrets")
        .select("name, decrypted_secret")
        .in("name", ["rede_pv", "rede_token", "rede_ambiente"]);
      if (!error && data?.length > 0) {
        // deno-lint-ignore no-explicit-any
        data.forEach((s: any) => {
          if (s.decrypted_secret) m[s.name] = s.decrypted_secret;
        });
      }
    } catch { /* ignore */ }
  }

  if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";

  return {
    pv: m["rede_pv"] ?? "",
    token: m["rede_token"] ?? "",
    ambiente: (m["rede_ambiente"] as "sandbox" | "producao") ?? "sandbox",
  };
}

export function redeBaseUrl(ambiente: "sandbox" | "producao"): string {
  return REDE_URLS[ambiente] ?? REDE_URLS.sandbox;
}

export interface RefundResult {
  /** true somente quando a Rede confirmou o estorno. */
  ok: boolean;
  httpStatus: number;
  returnCode?: string;
  returnMessage?: string;
  nsu?: string | null;
  authorizationCode?: string | null;
  // deno-lint-ignore no-explicit-any
  raw: any;
  rawText: string;
  /** Preenchido quando nem chegou a haver resposta da Rede. */
  transportError?: string;
}

/**
 * Executa o refund na Rede. Não grava nada no banco — quem chama decide
 * o que persistir, sempre DEPOIS de `ok === true`.
 */
export async function executarRefundRede(params: {
  accessToken: string;
  baseUrl: string;
  tid: string;
  amountCents: number;
  logPrefix?: string;
}): Promise<RefundResult> {
  const { accessToken, baseUrl, tid, amountCents } = params;
  const prefix = params.logPrefix ?? "[rede-refund]";

  let httpStatus = 0;
  let rawText = "";
  // deno-lint-ignore no-explicit-any
  let raw: any = null;

  try {
    console.log(`${prefix} estornando tid=${tid} amount=${amountCents} (centavos)`);
    const resp = await fetch(`${baseUrl}/transactions/${tid}/refunds`, {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountCents }),
    });
    httpStatus = resp.status;
    rawText = await resp.text();
    try { raw = JSON.parse(rawText); } catch { raw = { rawText }; }
  } catch (e) {
    return {
      ok: false,
      httpStatus,
      raw: null,
      rawText,
      transportError: String(e),
    };
  }

  const returnCode = String(raw?.returnCode ?? "");
  const ok = REFUND_SUCCESS_CODES.includes(returnCode);

  if (!ok && httpStatus >= 200 && httpStatus < 300) {
    console.warn(
      `${prefix} HTTP 2xx com returnCode não reconhecido: http=${httpStatus} returnCode=${returnCode} returnMessage=${raw?.returnMessage ?? rawText.slice(0, 500)}`,
    );
  }

  return {
    ok,
    httpStatus,
    returnCode: raw?.returnCode ? String(raw.returnCode) : undefined,
    returnMessage: raw?.returnMessage ?? undefined,
    nsu: raw?.nsu ?? raw?.refundId ?? null,
    authorizationCode: raw?.authorizationCode ?? null,
    raw,
    rawText,
  };
}
