// ─────────────────────────────────────────────────────────────
// Lógica pura compartilhada da integração e-Rede.
//
// REGRA: este módulo é uma RELOCALIZAÇÃO de código que já existia
// duplicado em rede-cobrar-cartao/index.ts e rede-cobrar-token/index.ts.
// O comportamento é idêntico ao anterior, incluindo peculiaridades
// (ex.: corte de `reference` em 20 chars, Luhn exigindo >= 12 dígitos).
// Não alterar sem revisão — toca cobrança em produção.
// ─────────────────────────────────────────────────────────────

// ── URLs por ambiente ────────────────────────────────────────

export type RedeAmbiente = "sandbox" | "producao";

/** API transacional e-Rede v2 */
export const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
} as const;

/** Token Service — geração de criptograma de uso único (cobrança com token) */
export const TOKEN_SERVICE_URLS = {
  sandbox:  "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/cryptogram",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/cryptogram",
} as const;

/** Token Service — tokenização de cartão */
export const TOKENIZATION_URLS = {
  sandbox:  "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization",
} as const;

/** OAuth 2.0 client_credentials */
export const OAUTH_URLS = {
  sandbox:  "https://rl7-sandbox-api.useredecloud.com.br/oauth2/token",
  producao: "https://api.userede.com.br/redelabs/oauth2/token",
} as const;

function pick(map: Record<string, string>, ambiente: string | undefined | null): string {
  return map[ambiente as string] ?? map.sandbox;
}

/** Base da API transacional; qualquer ambiente desconhecido cai em sandbox. */
export function resolveRedeBaseUrl(ambiente?: string | null): string {
  return pick(REDE_URLS as unknown as Record<string, string>, ambiente);
}

/** Endpoint de criptograma; qualquer ambiente desconhecido cai em sandbox. */
export function resolveTokenServiceUrl(ambiente?: string | null): string {
  return pick(TOKEN_SERVICE_URLS as unknown as Record<string, string>, ambiente);
}

/** Endpoint de tokenização; qualquer ambiente desconhecido cai em sandbox. */
export function resolveTokenizationUrl(ambiente?: string | null): string {
  return pick(TOKENIZATION_URLS as unknown as Record<string, string>, ambiente);
}

/** Endpoint OAuth; só "producao" usa produção (mesma regra de rede-auth.ts). */
export function resolveOAuthUrl(ambiente?: string | null): string {
  return ambiente === "producao" ? OAUTH_URLS.producao : OAUTH_URLS.sandbox;
}

// ── Validação de cartão ──────────────────────────────────────

/**
 * Validação Luhn. Mantém a peculiaridade da versão original:
 * números com menos de 12 dígitos são rejeitados antes do cálculo.
 */
export function luhn(n: string): boolean {
  const d = String(n ?? "").replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let digit = parseInt(d[i]);
    if (odd) { digit *= 2; if (digit > 9) digit -= 9; }
    s += digit; odd = !odd;
  }
  return s % 10 === 0;
}

// ── Normalização de campos do payload ────────────────────────

/** trim + UPPERCASE + remoção de acentos (NFD + strip de diacríticos). */
export function normalizeCardholderName(nome: unknown): string {
  return String(nome ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Mês com 2 dígitos ("3" → "03"). */
export function formatExpirationMonth(mes: unknown): string {
  return String(mes).padStart(2, "0");
}

/** Ano: 2 dígitos vira 4 ("29" → "2029"); demais formatos passam apenas com trim. */
export function formatExpirationYear(ano: unknown): string {
  const y = String(ano).trim();
  return y.length === 2 ? "20" + y : y;
}

/** `reference` da Rede: uuid sem hífens, cortado em 20 caracteres. */
export function buildReference(vendaId: unknown): string {
  return String(vendaId).replace(/-/g, "").slice(0, 20);
}

// ── Valores monetários ───────────────────────────────────────

/** Reais → centavos (inteiro), com fallback 0 para valores não numéricos. */
export function toCentavos(valor: unknown): number {
  return Math.round((Number(valor) || 0) * 100);
}

export interface VendaAmountInput {
  tipo_cobranca?: string | null;
  valor?: unknown;
  desconto?: unknown;
  taxa_mensal?: unknown;
  valor_final?: unknown;
}

/** Subtotal da venda: valor - desconto, nunca negativo. */
export function calcularSubtotal(venda: VendaAmountInput | null | undefined): number {
  return Math.max(0, (Number(venda?.valor) || 0) - (Number(venda?.desconto) || 0));
}

/** Valor mensal de um plano recorrente: subtotal / período + taxa mensal. */
export function calcularValorMensal(
  venda: VendaAmountInput | null | undefined,
  periodoMeses: unknown,
): number {
  const periodo = normalizarPeriodoMeses(periodoMeses);
  return calcularSubtotal(venda) / periodo + (Number(venda?.taxa_mensal) || 0);
}

/** Período em meses do plano: inteiro >= 1 (0, null ou NaN viram 1). */
export function normalizarPeriodoMeses(periodoMeses: unknown): number {
  return Math.max(1, Number(periodoMeses) || 1);
}

export function isRecorrencia(venda: VendaAmountInput | null | undefined): boolean {
  return venda?.tipo_cobranca === "recorrencia";
}

/**
 * Valor a cobrar AGORA, em centavos.
 * - Recorrência: apenas a 1ª mensalidade (subtotal / período + taxa mensal).
 * - Demais casos: `valor_final` da venda.
 */
export function calcularAmountCentavos(
  venda: VendaAmountInput | null | undefined,
  periodoMeses?: unknown,
): number {
  if (isRecorrencia(venda)) {
    return Math.round(calcularValorMensal(venda, periodoMeses) * 100);
  }
  return toCentavos(venda?.valor_final);
}

// ── Mapa de returnCode ───────────────────────────────────────

export interface RedeReturnCodeResult {
  /** Código normalizado; ausente vira "XX". */
  returnCode: string;
  approved: boolean;
  /** Status persistido em pagamentos_rede. */
  status: "approved" | "denied";
  /** Status da venda em `vendas.status_pagamento`. */
  statusVenda: "pago" | "falha";
  /** returnCode 54 = cartão expirado → desativar cartão salvo e limpar token do plano. */
  desativarCartao: boolean;
}

/** Interpreta o returnCode da Rede. "00" = aprovado; "54" = cartão expirado. */
export function mapReturnCode(returnCode: unknown): RedeReturnCodeResult {
  const code = (returnCode ?? "XX") as string;
  const approved = code === "00";
  return {
    returnCode: code,
    approved,
    status: approved ? "approved" : "denied",
    statusVenda: approved ? "pago" : "falha",
    desativarCartao: code === "54",
  };
}

// ── Credenciais (env vars → Vault → default sandbox) ─────────

function readEnv(name: string): string {
  // Acesso defensivo: em runtime Deno usa Deno.env; fora dele (testes) retorna "".
  return (globalThis as any).Deno?.env?.get?.(name) ?? "";
}

export interface LoadSecretsOptions {
  /** Logs de diagnóstico (nenhum expõe valor de segredo). Default: false. */
  verbose?: boolean;
}

/**
 * Carrega credenciais da Rede.
 * 1) Edge Function Secrets (REDE_PV / REDE_TOKEN / REDE_AMBIENTE)
 * 2) Fallback: Supabase Vault (vault.decrypted_secrets)
 * 3) `rede_ambiente` default "sandbox"
 */
export async function loadSecrets(
  supabase: any,
  options: LoadSecretsOptions = {},
): Promise<Record<string, string>> {
  const verbose = options.verbose === true;
  const m: Record<string, string> = {};

  const envPv      = readEnv("REDE_PV");
  const envToken   = readEnv("REDE_TOKEN");
  const envAmbient = readEnv("REDE_AMBIENTE");

  if (envPv)      m["rede_pv"]       = envPv;
  if (envToken)   m["rede_token"]    = envToken;
  if (envAmbient) m["rede_ambiente"] = envAmbient;

  if (m["rede_pv"] && m["rede_token"]) {
    if (verbose) {
      console.log("[rede] credenciais via env vars OK — ambiente:", m["rede_ambiente"] || "sandbox (default)");
    }
    if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";
    return m;
  }

  try {
    const { data, error } = await supabase
      .schema("vault")
      .from("decrypted_secrets")
      .select("name, decrypted_secret")
      .in("name", ["rede_pv", "rede_token", "rede_ambiente"]);

    if (!error && data?.length > 0) {
      data.forEach((s: any) => { if (s.decrypted_secret) m[s.name] = s.decrypted_secret; });
      if (verbose) console.log("[rede] credenciais via Vault:", Object.keys(m).join(", "));
    } else if (verbose) {
      console.warn("[rede] Vault indisponível:", error?.message ?? "sem dados");
    }
  } catch (e) {
    if (verbose) console.warn("[rede] Vault exception:", String(e));
  }

  if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";

  if (verbose) {
    console.log("[rede] status final credenciais:", {
      pv_ok:    (m["rede_pv"] ?? "").length > 0,
      token_ok: (m["rede_token"] ?? "").length > 0,
      ambiente: m["rede_ambiente"],
    });
  }

  return m;
}
