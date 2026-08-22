// ─────────────────────────────────────────────────────────────
// Núcleo de cobrança com cartão tokenizado (MIT / subscription).
//
// REGRA: este módulo é uma RELOCALIZAÇÃO do miolo que já existia em
// rede-cobrar-token/index.ts — geração de criptograma de uso único no
// Token Service + POST /transactions + interpretação do returnCode.
// O comportamento (payload, ordem das chamadas, peculiaridades como
// storageCard = "2") é idêntico ao anterior.
//
// Este arquivo NÃO toca banco: nada de vendas, cobrancas, cartoes_salvos
// ou system_logs. Efeitos colaterais são responsabilidade de quem chama.
// Não alterar sem revisão — toca cobrança em produção.
// ─────────────────────────────────────────────────────────────

import { mapReturnCode } from "./rede-payload.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CobrarComTokenInput {
  /** tokenization_id ativo (rede_tokenizacoes.tokenization_id). */
  tokenizationId: string;
  /** Valor JÁ em centavos. */
  amountCentavos: number;
  installments?: number;
  /** `reference` da Rede (uuid sem hífens — usar buildReference). */
  reference: string;
  /** Número tokenizado do cartão (cartoes_salvos.token_rede). */
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  /** access_token OAuth já obtido (getRedeAccessToken). */
  accessToken: string;
  /** Base da API transacional (resolveRedeBaseUrl). */
  baseUrl: string;
  /** Base do Token Service de criptograma (resolveTokenServiceUrl). */
  tokenServiceBaseUrl: string;
  /** Injeção para teste; default: fetch global. */
  fetchImpl?: FetchLike;
}

export type CobrarComTokenErrorKind =
  /** Falha de comunicação (exceção no fetch). */
  | "network"
  /** Token Service respondeu, mas sem criptograma válido. */
  | "criptograma";

export interface CobrarComTokenResult {
  /** Etapa em que o fluxo terminou. */
  stage: "cryptogram" | "transaction";
  /** true apenas quando a transação foi aprovada (returnCode "00"). */
  approved: boolean;
  /**
   * Preenchido quando não houve resposta transacional interpretável.
   * `null` significa que a Rede respondeu a transação (aprovada ou negada).
   */
  errorKind: CobrarComTokenErrorKind | null;
  /** Mensagem de erro técnico, quando errorKind != null. */
  error: string | null;
  /** HTTP status da última chamada realizada. */
  httpStatus: number;
  returnCode: string | null;
  returnMessage: string | null;
  /** returnCode 54 (cartão expirado) → cartão salvo deve ser desativado. */
  desativarCartao: boolean;
  tid: string | null;
  nsu: string | null;
  authorizationCode: string | null;
  /** Corpo bruto da última resposta (criptograma em falha, transação caso contrário). */
  raw: unknown;
}

async function postJson(
  fetchImpl: FetchLike,
  url: string,
  accessToken: string,
  body: unknown,
): Promise<{ status: number; parsed: any; text: string }> {
  const resp = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { rawText: text };
  }
  return { status: resp.status, parsed, text };
}

/**
 * Executa a cobrança MIT com cartão tokenizado.
 * Nunca lança: falhas de rede voltam como `errorKind: "network"`.
 */
export async function cobrarComToken(input: CobrarComTokenInput): Promise<CobrarComTokenResult> {
  const fetchImpl = input.fetchImpl ?? ((globalThis as any).fetch as FetchLike);
  const installments = input.installments ?? 1;

  // ── 1. Criptograma de uso único ────────────────────────────
  let crypto: { status: number; parsed: any; text: string };
  try {
    crypto = await postJson(
      fetchImpl,
      `${input.tokenServiceBaseUrl}/${input.tokenizationId}`,
      input.accessToken,
      { subscription: true },
    );
  } catch (e) {
    return {
      stage: "cryptogram",
      approved: false,
      errorKind: "network",
      error: String(e),
      httpStatus: 0,
      returnCode: null,
      returnMessage: null,
      desativarCartao: false,
      tid: null,
      nsu: null,
      authorizationCode: null,
      raw: null,
    };
  }

  const cryptoReturnCode = crypto.parsed?.returnCode ?? null;
  const tokenCryptogram = crypto.parsed?.cryptogramInfo?.tokenCryptogram ?? null;
  if (crypto.status < 200 || crypto.status >= 300 || cryptoReturnCode !== "00" || !tokenCryptogram) {
    return {
      stage: "cryptogram",
      approved: false,
      errorKind: "criptograma",
      error: crypto.parsed?.returnMessage ?? "Falha ao gerar criptograma de cobrança",
      httpStatus: crypto.status,
      returnCode: cryptoReturnCode,
      returnMessage: crypto.parsed?.returnMessage ?? null,
      desativarCartao: false,
      tid: null,
      nsu: null,
      authorizationCode: null,
      raw: crypto.parsed,
    };
  }

  // ── 2. Transação ───────────────────────────────────────────
  const payload = {
    capture: true,
    kind: "credit",
    reference: input.reference,
    amount: input.amountCentavos,
    installments,
    // Divergência mantida: cobrança com token usa storageCard string "2" (MIT).
    storageCard: "2",
    cardNumber: input.cardNumber,
    expirationMonth: input.expirationMonth,
    expirationYear: input.expirationYear,
    cardholderName: input.cardholderName,
    tokenCryptogram,
    subscription: true,
  };

  let tx: { status: number; parsed: any; text: string };
  try {
    tx = await postJson(fetchImpl, `${input.baseUrl}/transactions`, input.accessToken, payload);
  } catch (e) {
    return {
      stage: "transaction",
      approved: false,
      errorKind: "network",
      error: String(e),
      httpStatus: 0,
      returnCode: null,
      returnMessage: null,
      desativarCartao: false,
      tid: null,
      nsu: null,
      authorizationCode: null,
      raw: null,
    };
  }

  const { returnCode, approved, desativarCartao } = mapReturnCode(tx.parsed?.returnCode);

  return {
    stage: "transaction",
    approved,
    errorKind: null,
    error: null,
    httpStatus: tx.status,
    returnCode,
    returnMessage: tx.parsed?.returnMessage ?? null,
    desativarCartao,
    tid: tx.parsed?.tid ?? null,
    nsu: tx.parsed?.nsu ?? null,
    authorizationCode: tx.parsed?.authorizationCode ?? null,
    raw: tx.parsed,
  };
}

/** Motivos legíveis para códigos conhecidos; demais usam o returnMessage da Rede. */
const MOTIVOS_CONHECIDOS: Record<string, string> = {
  "51": "Cartão sem limite",
  "54": "Cartão vencido",
  "57": "Transação não permitida para este cartão",
  "62": "Cartão restrito",
  "78": "Cartão bloqueado",
  "82": "Cartão inválido",
  "05": "Cobrança não autorizada pelo banco emissor",
};

/** Texto humano da recusa — nunca o código cru da Rede. */
export function motivoRecusaLegivel(
  returnCode: string | null | undefined,
  returnMessage: string | null | undefined,
): string {
  const conhecido = returnCode ? MOTIVOS_CONHECIDOS[returnCode] : undefined;
  if (conhecido) return conhecido;
  const msg = (returnMessage ?? "").trim();
  if (msg) return msg;
  return "Cobrança recusada pelo banco emissor";
}
