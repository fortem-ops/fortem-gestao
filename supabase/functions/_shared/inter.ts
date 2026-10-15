// Shared helpers for Banco Inter Pix Automático integration.
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, PATCH, PUT, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireAdminOrCoord(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const token = authHeader.slice(7);
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const userId = data.claims.sub as string;
  const sup = admin();
  const { data: roles } = await sup
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = (roles ?? []).some((r: any) =>
    r.role === "admin" || r.role === "coordenador"
  );
  if (!allowed) return { error: jsonResponse({ error: "Forbidden" }, 403) };
  return { userId };
}

export async function requireAdmin(req: Request) {
  const auth = await requireAdminOrCoord(req);
  if ("error" in auth) return auth;
  const { data: isA } = await admin().rpc("is_admin", { _user_id: auth.userId });
  if (!isA) return { error: jsonResponse({ error: "Forbidden" }, 403) };
  return auth;
}

// ---------- Banco Inter (Pix Automático) ----------
// Chave única que escolhe o conjunto de credenciais do Pix Automático.
// "cob"   = INTER_COB_* (integração de 10/09/2026, com Pix Automático liberado) — PADRÃO.
// "inter" = INTER_*     (integração de 22/06/2026) — reserva, mantida só para reverter.
export type CredInter = "cob" | "inter";
export const CRED_PIX_AUTOMATICO: CredInter = "cob";

const BASE_URL = (Deno.env.get("INTER_BASE_URL") ?? "").replace(/\/$/, "");
const CONTA = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";

export const SCOPES_PIX_AUTOMATICO = [
  "rec.write","rec.read","solicrec.write","solicrec.read",
  "cobr.write","cobr.read","webhookrec.write","webhookrec.read",
  "webhookcobr.write","webhookcobr.read","webhook.write","webhook.read",
  "cob.write","cob.read","cobv.write","cobv.read","pix.write","pix.read",
  "payloadlocationrec.write","payloadlocationrec.read",
].join(" ");

function envCred(cred: CredInter, nome: string): string {
  return Deno.env.get(cred === "cob" ? `INTER_COB_${nome}` : `INTER_${nome}`) ?? "";
}

function normalizePem(raw: string, kind: "CERT" | "KEY"): string {
  let s = raw.trim();
  if (s.includes("\\n")) s = s.replace(/\\r/g, "").replace(/\\n/g, "\n");
  if (!s.includes("-----BEGIN")) {
    try {
      const decoded = atob(s.replace(/\s+/g, ""));
      if (decoded.includes("-----BEGIN")) s = decoded;
    } catch { /* ignore */ }
  }
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() + "\n";
  if (!s.includes("-----BEGIN")) throw new Error(`Certificado/chave ${kind} inválido: nenhum bloco PEM encontrado`);
  return s;
}

const _clients: Partial<Record<CredInter, any>> = {};
function getHttpClient(cred: CredInter = CRED_PIX_AUTOMATICO): any {
  if (_clients[cred]) return _clients[cred];
  const certRaw = envCred(cred, "CERT_PEM");
  const keyRaw = envCred(cred, "KEY_PEM");
  if (!certRaw || !keyRaw) throw new Error(`Certificado/chave ausentes para a credencial ${cred}`);
  // @ts-ignore Deno.createHttpClient is unstable but available in Supabase Edge Runtime
  _clients[cred] = Deno.createHttpClient({ cert: normalizePem(certRaw, "CERT"), key: normalizePem(keyRaw, "KEY") });
  return _clients[cred];
}

async function fetchNewToken(cred: CredInter, scope: string): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const clientId = envCred(cred, "CLIENT_ID");
  const clientSecret = envCred(cred, "CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error(`Credenciais ausentes para ${cred}`);
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials", scope });
  const res = await fetch(`${new URL(BASE_URL).origin}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // @ts-ignore unstable client option
    client: getHttpClient(cred),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Inter OAuth (${cred}) ${res.status}: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text);
  console.log("[inter:oauth] credencial:", cred, "expires_in:", parsed.expires_in, "scope:", parsed.scope);
  return parsed;
}

/** true se todos os escopos pedidos estão contidos no escopo do token. */
export function escopoContido(pedido: string, doToken: string | null | undefined): boolean {
  const tem = new Set(String(doToken ?? "").split(/\s+/).filter(Boolean));
  return pedido.split(/\s+/).filter(Boolean).every((s) => tem.has(s));
}

/**
 * Token do Pix Automático. Cache em inter_tokens isolado por credencial (coluna credencial)
 * e por escopo (só reaproveita se o escopo pedido estiver contido no do token).
 * Tokens antigos sem credencial (emitidos pela integração de 22/06) são ignorados.
 * A Loja/Corrida usa outro cache (inter_cob_tokens, em inter-cob.ts) e não é afetada.
 */
export async function getInterToken(cred: CredInter = CRED_PIX_AUTOMATICO, scope: string = SCOPES_PIX_AUTOMATICO): Promise<string> {
  const sup = admin();
  const nowIso = new Date(Date.now() + 60_000).toISOString();
  const { data: rows } = await sup
    .from("inter_tokens")
    .select("access_token, expires_at, scope")
    .eq("credencial", cred)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(10);
  const hit = (rows ?? []).find((r: any) => escopoContido(scope, r.scope));
  if (hit?.access_token) return hit.access_token as string;

  const tok = await fetchNewToken(cred, scope);
  const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await sup.from("inter_tokens").insert({
    access_token: tok.access_token,
    expires_at: expiresAt,
    scope: tok.scope ?? scope,
    credencial: cred,
  });
  return tok.access_token;
}

export async function interFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  cred: CredInter = CRED_PIX_AUTOMATICO,
): Promise<{ status: number; data: any; raw: string }> {
  const token = await getInterToken(cred);
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "x-conta-corrente": CONTA,
    "Accept": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const url = `${new URL(BASE_URL).origin}${path}`;
  console.log("[inter:fetch]", cred, init.method ?? "GET", path);
  const res = await fetch(url, {
    ...init,
    headers,
    body,
    // @ts-ignore unstable client option
    client: getHttpClient(cred),
  });
  const raw = await res.text();
  if (res.status >= 400) console.error("[inter:fetch] status:", res.status, "raw:", raw.substring(0, 300));
  else console.log("[inter:fetch] status:", res.status);
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: res.status, data, raw };
}

export function genTxid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function onlyDigits(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Somente leitura: token novo (sem cache) e devolve só os escopos concedidos (nunca o token). */
export async function consultarEscoposInter(cred: CredInter = CRED_PIX_AUTOMATICO): Promise<{ escopos: string | null; expires_in: number | null }> {
  const tok = await fetchNewToken(cred, SCOPES_PIX_AUTOMATICO);
  return { escopos: tok.scope ?? null, expires_in: tok.expires_in ?? null };
}

/** Diagnóstico: token com escopos específicos, sem cache e sem log do token. */
export async function tokenDiagnostico(scope: string, cred: CredInter = CRED_PIX_AUTOMATICO): Promise<{ ok: boolean; status: number; token?: string; scope?: string; erro?: string }> {
  try {
    const t = await fetchNewToken(cred, scope);
    return { ok: true, status: 200, token: t.access_token, scope: t.scope };
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    const st = Number(m.match(/ (\d{3}):/)?.[1] ?? 0);
    return { ok: false, status: st, erro: m.slice(0, 200) };
  }
}

export async function getDiagnostico(path: string, token: string, conta = true, cred: CredInter = CRED_PIX_AUTOMATICO): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (conta) headers["x-conta-corrente"] = CONTA;
  const res = await fetch(`${new URL(BASE_URL).origin}${path}`, {
    method: "GET", headers,
    // @ts-ignore unstable client option
    client: getHttpClient(cred),
  });
  const raw = await res.text();
  let data: any = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* raw */ }
  return { status: res.status, data };
}

export async function infoDiagnostico(cred: CredInter = CRED_PIX_AUTOMATICO) {
  const id = envCred(cred, "CLIENT_ID");
  const conta = onlyDigits(CONTA);
  let cert: Record<string, unknown> = {};
  try {
    const { X509Certificate } = await import("node:crypto");
    const x = new X509Certificate(normalizePem(envCred(cred, "CERT_PEM"), "CERT"));
    cert = { subject: x.subject, validFrom: x.validFrom, validTo: x.validTo };
  } catch (e) { cert = { erro: String((e as Error)?.message ?? e).slice(0, 120) }; }
  return {
    credencial: cred,
    client_id_prefixo: id.substring(0, 8),
    host: BASE_URL ? new URL(BASE_URL).host : null,
    conta_vs_41075951: conta === "41075951" ? "igual" : "diferente",
    conta_ultimos3: conta.slice(-3),
    cert,
  };
}
