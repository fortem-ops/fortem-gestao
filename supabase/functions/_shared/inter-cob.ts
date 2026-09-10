// Shared helpers for the Banco Inter "Pix Completo" integration (loja / cobrança imediata).
// Uses its own app credentials (INTER_COB_*) and its own token cache table (inter_cob_tokens).
// Does NOT touch the legacy "Pix Automático" integration in _shared/inter.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = (Deno.env.get("INTER_BASE_URL") ?? "").replace(/\/$/, "");
const CONTA = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
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
  if (!s.includes("-----BEGIN")) {
    throw new Error(`INTER_COB_${kind}_PEM inválido: nenhum bloco PEM encontrado`);
  }
  return s;
}

let _httpClient: any = null;
function getHttpClient(): any {
  if (_httpClient) return _httpClient;
  const certRaw = Deno.env.get("INTER_COB_CERT_PEM");
  const keyRaw = Deno.env.get("INTER_COB_KEY_PEM");
  if (!certRaw || !keyRaw) {
    throw new Error("INTER_COB_CERT_PEM / INTER_COB_KEY_PEM ausentes");
  }
  const cert = normalizePem(certRaw, "CERT");
  const key = normalizePem(keyRaw, "KEY");
  console.log("[inter-cob] CERT len=", cert.length, "KEY len=", key.length);
  // @ts-ignore Deno.createHttpClient is unstable but available in Supabase Edge Runtime
  _httpClient = Deno.createHttpClient({ cert, key });
  return _httpClient;
}

const SCOPES = [
  "cob.write", "cob.read",
  "webhook.write", "webhook.read",
  "pix.write", "pix.read",
].join(" ");

async function fetchNewToken(): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const clientId = Deno.env.get("INTER_COB_CLIENT_ID");
  const clientSecret = Deno.env.get("INTER_COB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("INTER_COB_CLIENT_ID/SECRET ausentes");
  }
  console.log(
    "[inter-cob:oauth] CLIENT_ID:",
    clientId.substring(0, 8) + "..." + clientId.slice(-4),
  );
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: SCOPES,
  });
  const origin = new URL(BASE_URL).origin;
  const res = await fetch(`${origin}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // @ts-ignore unstable client option
    client: getHttpClient(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Inter COB OAuth ${res.status}: ${text}`);
  const parsed = JSON.parse(text);
  console.log("[inter-cob:oauth] expires_in:", parsed.expires_in, "scope:", parsed.scope);
  return parsed;
}

export async function getInterCobToken(): Promise<string> {
  const sup = admin();
  const nowIso = new Date(Date.now() + 60_000).toISOString();
  const { data: existing } = await sup
    .from("inter_cob_tokens")
    .select("access_token, expires_at")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.access_token) return existing.access_token as string;

  const tok = await fetchNewToken();
  const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await sup.from("inter_cob_tokens").insert({
    access_token: tok.access_token,
    expires_at: expiresAt,
    scope: tok.scope ?? SCOPES,
  });
  return tok.access_token;
}

export async function interCobFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; data: any; raw: string }> {
  const token = await getInterCobToken();
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
  const origin = new URL(BASE_URL).origin;
  const url = `${origin}${path}`;
  console.log("[inter-cob:fetch]", init.method ?? "GET", url);
  if (init.json !== undefined) {
    console.log("[inter-cob:fetch] payload:", JSON.stringify(init.json));
  }
  const res = await fetch(url, {
    ...init,
    headers,
    body,
    // @ts-ignore unstable client option
    client: getHttpClient(),
  });
  const raw = await res.text();
  if (res.status >= 400) {
    console.error("[inter-cob:fetch] status:", res.status, "raw:", raw.substring(0, 800));
  } else {
    console.log("[inter-cob:fetch] status:", res.status);
  }
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: res.status, data, raw };
}
