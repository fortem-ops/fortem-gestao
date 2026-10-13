// Chamadas à Rede do cartão do /planos. Número/CVV só em memória; nada é logado.
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

type Amb = "sandbox" | "producao";
const TOKEN_URL = {
  sandbox: "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization",
};
const CRIPTO_URL = {
  sandbox: "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/cryptogram",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/cryptogram",
};
const REDE_URL = { sandbox: "https://sandbox-erede.useredecloud.com.br/v2", producao: "https://api.userede.com.br/erede/v2" };
const TIMEOUT_MS = 25_000;

export type Acesso = { token: string; amb: Amb };

export async function acessoRede(): Promise<Acesso | null> {
  const pv = (Deno.env.get("REDE_PV") ?? "").trim();
  const tk = (Deno.env.get("REDE_TOKEN") ?? "").trim();
  const amb = ((Deno.env.get("REDE_AMBIENTE") ?? "sandbox").trim() === "producao" ? "producao" : "sandbox") as Amb;
  if (!pv || !tk) return null;
  try { return { token: await getRedeAccessToken(pv, tk, amb), amb }; } catch { return null; }
}

async function chamar(url: string, a: Acesso, method: "GET" | "POST", body?: unknown) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method, signal: ctl.signal,
      headers: { Authorization: "Bearer " + a.token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    return { httpStatus: r.status, parsed, erroRede: false };
  } catch {
    return { httpStatus: 0, parsed: null, erroRede: true };
  } finally { clearTimeout(timer); }
}

export async function tokenizar(a: Acesso, d: { numero: string; nome: string; mes: string; ano: string; cvv: string }) {
  const r = await chamar(TOKEN_URL[a.amb], a, "POST", {
    email: "cobranca@fortem.app", cardNumber: d.numero, expirationMonth: d.mes, expirationYear: d.ano,
    cardholderName: d.nome, securityCode: d.cvv, storageCard: "2", embeddedZeroDollar: true,
  });
  const id = r.parsed?.tokenizationId ?? r.parsed?.data?.tokenizationId ?? null;
  const rc = r.parsed?.returnCode ?? null;
  const ok = !r.erroRede && r.httpStatus >= 200 && r.httpStatus < 300 && !!id && (rc == null || rc === "00");
  return { ok, tokenizationId: id ? String(id) : null, httpStatus: r.httpStatus, returnCode: rc };
}

export const consultarToken = (a: Acesso, tokenizationId: string) =>
  chamar(`${TOKEN_URL[a.amb]}/${tokenizationId}`, a, "GET");

/** Criptograma (compra única, subscription=false, igual à Loja) + transação. */
export async function cobrar(a: Acesso, i: {
  tokenizationId: string; tokenCode: string; mes: string; ano: string; nome: string;
  centavos: number; parcelas: number; reference: string; softDescriptor: string;
}) {
  const c = await chamar(`${CRIPTO_URL[a.amb]}/${i.tokenizationId}`, a, "POST", { subscription: false });
  const cripto = c.parsed?.cryptogramInfo?.tokenCryptogram ?? null;
  if (c.erroRede || c.httpStatus < 200 || c.httpStatus >= 300 || c.parsed?.returnCode !== "00" || !cripto) {
    return { etapa: "criptograma" as const, httpStatus: c.httpStatus, parsed: null, erroRede: false };
  }
  const payload: Record<string, unknown> = {
    capture: true, kind: "credit", reference: i.reference, amount: i.centavos, installments: i.parcelas,
    storageCard: "2", cardNumber: i.tokenCode, expirationMonth: i.mes, expirationYear: i.ano,
    cardholderName: i.nome, tokenCryptogram: cripto,
  };
  if (i.softDescriptor) payload.softDescriptor = i.softDescriptor;
  const t = await chamar(`${REDE_URL[a.amb]}/transactions`, a, "POST", payload);
  return { etapa: "transacao" as const, ...t };
}

export const consultarPorReferencia = (a: Acesso, reference: string) =>
  chamar(`${REDE_URL[a.amb]}/transactions?reference=${encodeURIComponent(reference)}`, a, "GET");
