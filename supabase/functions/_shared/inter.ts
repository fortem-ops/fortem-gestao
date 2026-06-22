// Shared helpers for Banco Inter Pix Automático integration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ---------- Banco Inter ----------

const BASE_URL = (Deno.env.get("INTER_BASE_URL") ?? "").replace(/\/$/, "");
const CONTA = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";

function normalizePem(raw: string, kind: "CERT" | "KEY"): string {
  let s = raw.trim();
  // Unescape literal \n / \r if pasted as a single line.
  if (s.includes("\\n")) s = s.replace(/\\r/g, "").replace(/\\n/g, "\n");
  // If no PEM header present, assume it's base64-encoded PEM and decode.
  if (!s.includes("-----BEGIN")) {
    try {
      const decoded = atob(s.replace(/\s+/g, ""));
      if (decoded.includes("-----BEGIN")) s = decoded;
    } catch { /* ignore */ }
  }
  // Normalize CRLF -> LF and ensure trailing newline.
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() + "\n";
  if (!s.includes("-----BEGIN")) {
    throw new Error(`INTER_${kind}_PEM inválido: nenhum bloco PEM encontrado`);
  }
  return s;
}

let _httpClient: any = null;
function getHttpClient(): any {
  if (_httpClient) return _httpClient;
  const certRaw = Deno.env.get("INTER_CERT_PEM");
  const keyRaw = Deno.env.get("INTER_KEY_PEM");
  if (!certRaw || !keyRaw) throw new Error("INTER_CERT_PEM / INTER_KEY_PEM ausentes");
  console.log("[inter] CERT raw prefix:", certRaw.substring(0, 30));
  console.log("[inter] KEY  raw prefix:", keyRaw.substring(0, 30));
  const cert = normalizePem(certRaw, "CERT");
  const key = normalizePem(keyRaw, "KEY");
  console.log("[inter] CERT normalized prefix:", cert.substring(0, 30), "len=", cert.length);
  console.log("[inter] KEY  normalized prefix:", key.substring(0, 30), "len=", key.length);
  console.log("[inter] CLIENT_ID present:", !!Deno.env.get("INTER_CLIENT_ID"), "CONTA:", Deno.env.get("INTER_CONTA_CORRENTE"));
  // @ts-ignore Deno.createHttpClient is unstable but available in Supabase Edge Runtime
  _httpClient = Deno.createHttpClient({ cert, key });
  return _httpClient;
}

const SCOPES = [
  "cobv.write","cobv.read","cob.write","cob.read",
  "rec.write","rec.read","solicrec.write","solicrec.read",
  "webhook.write","webhook.read","pix.write","pix.read",
].join(" ");

async function fetchNewToken(): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const clientId = Deno.env.get("INTER_CLIENT_ID");
  const clientSecret = Deno.env.get("INTER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("INTER_CLIENT_ID/SECRET ausentes");
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
  if (!res.ok) throw new Error(`Inter OAuth ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function getInterToken(): Promise<string> {
  const sup = admin();
  const nowIso = new Date(Date.now() + 60_000).toISOString();
  const { data: existing } = await sup
    .from("inter_tokens")
    .select("access_token, expires_at")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.access_token) return existing.access_token as string;

  const tok = await fetchNewToken();
  const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await sup.from("inter_tokens").insert({
    access_token: tok.access_token,
    expires_at: expiresAt,
    scope: tok.scope ?? SCOPES,
  });
  return tok.access_token;
}

export async function interFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; data: any; raw: string }> {
  const token = await getInterToken();
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
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers,
    body,
    // @ts-ignore unstable client option
    client: getHttpClient(),
  });
  const raw = await res.text();
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
