// Banco Inter — API Banking v2 (Pagamento Pix). Credenciais próprias: INTER_PAGAMENTO_*.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { admin, jsonResponse } from "./inter.ts";

function normalizePem(raw: string, label: "CERTIFICATE" | "PRIVATE KEY"): string {
  let s = raw.trim().replace(/^["']|["']$/g, "");
  if (s.includes("\\n")) s = s.replace(/\\r/g, "").replace(/\\n/g, "\n");
  if (!s.includes("-----BEGIN")) {
    try {
      const d = atob(s.replace(/\s+/g, ""));
      if (d.includes("-----BEGIN")) s = d;
    } catch { /* ignore */ }
  }
  if (!s.includes("-----BEGIN")) {
    const b = s.replace(/\s+/g, "");
    s = `-----BEGIN ${label}-----\n${b.match(/.{1,64}/g)?.join("\n")}\n-----END ${label}-----`;
  } else {
    s = s.replace(/-----BEGIN ([A-Z ]+)-----\s*([\s\S]*?)\s*-----END \1-----/g, (_m, l, b) =>
      `-----BEGIN ${l}-----\n${String(b).replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END ${l}-----`);
  }
  return s.replace(/\r\n/g, "\n").trim() + "\n";
}

let _client: any = null;
function httpClient() {
  if (_client) return _client;
  const cert = normalizePem(Deno.env.get("INTER_PAGAMENTO_CERTIFICADO") ?? "", "CERTIFICATE");
  const key = normalizePem(Deno.env.get("INTER_PAGAMENTO_CHAVE_PRIVADA") ?? "", "PRIVATE KEY");
  // @ts-ignore unstable
  _client = Deno.createHttpClient({ cert, key });
  return _client;
}
const origin = () => new URL(Deno.env.get("INTER_BASE_URL") || "https://cdpj.partners.bancointer.com.br").origin;
const conta = () => Deno.env.get("INTER_CONTA_CORRENTE") ?? "";

let _token: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (_token && _token.exp > Date.now()) return _token.v;
  const r = await fetch(`${origin()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("INTER_PAGAMENTO_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("INTER_PAGAMENTO_CLIENT_SECRET") ?? "",
      grant_type: "client_credentials",
      scope: "pagamento-pix.write pagamento-pix.read",
    }),
    // @ts-ignore
    client: httpClient(),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Inter OAuth ${r.status}: ${t.substring(0, 300)}`);
  const j = JSON.parse(t);
  _token = { v: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) - 120) * 1000 };
  return _token.v;
}

async function parse(r: Response) {
  const raw = await r.text();
  let data: any = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* raw */ }
  return { status: r.status, data, raw };
}

export async function enviarPix(valor: number, chave: string, descricao: string, idempotente: string, dataPagamento?: string) {
  const payload: Record<string, unknown> = { valor: Number(valor.toFixed(2)), descricao: descricao.substring(0, 140), destinatario: { tipo: "CHAVE", chave } };
  if (dataPagamento) payload.dataPagamento = dataPagamento;
  const r = await fetch(`${origin()}/banking/v2/pix`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      "x-conta-corrente": conta(),
      "x-id-idempotente": idempotente,
    },
    body: JSON.stringify(payload),
    // @ts-ignore
    client: httpClient(),
  });
  return parse(r);
}

export async function consultarPix(codigo: string) {
  const r = await fetch(`${origin()}/banking/v2/pix/${encodeURIComponent(codigo)}`, {
    headers: { Authorization: `Bearer ${await token()}`, "x-conta-corrente": conta() },
    // @ts-ignore
    client: httpClient(),
  });
  return parse(r);
}

/** Retorna userId se for Admin; senão uma Response de erro. */
export async function exigirAdmin(req: Request): Promise<{ userId: string } | { error: Response }> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return { error: jsonResponse({ error: "unauthorized" }, 401) };
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: h } },
  });
  const { data, error } = await supa.auth.getClaims(h.slice(7));
  const sub = data?.claims?.sub as string | undefined;
  if (error || !sub) return { error: jsonResponse({ error: "unauthorized" }, 401) };
  const { data: ok } = await admin().rpc("is_admin", { _user_id: sub });
  if (!ok) return { error: jsonResponse({ error: "forbidden" }, 403) };
  return { userId: sub };
}
