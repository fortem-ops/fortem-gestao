// TESTE ISOLADO — API de Pagamento Pix (Banking v2) do Banco Inter.
// Só Admin autenticado pode chamar. Valor e chave são FIXOS (não aceita parâmetros),
// e exige { "confirmar": "PAGAR_1_REAL" } no corpo.
import { admin, corsHeaders, jsonResponse } from "../_shared/inter.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHAVE_DESTINO = "01574308041";
const VALOR = 1.0;

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
    // base64 puro (DER) sem cabeçalho → embrulha
    const b = s.replace(/\s+/g, "");
    s = `-----BEGIN ${label}-----\n${b.match(/.{1,64}/g)?.join("\n")}\n-----END ${label}-----`;
  } else {
    // PEM colado em uma linha só: refaz quebras
    s = s.replace(/-----BEGIN ([A-Z ]+)-----\s*([\s\S]*?)\s*-----END \1-----/g, (_m, l, b) =>
      `-----BEGIN ${l}-----\n${String(b).replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END ${l}-----`);
  }
  return s.replace(/\r\n/g, "\n").trim() + "\n";
}
function diag(raw: string) {
  const s = raw.trim();
  return { len: s.length, inicio: s.substring(0, 27), tem_begin: s.includes("-----BEGIN"), tem_barra_n: s.includes("\\n") };
}

async function requireAdmin(req: Request) {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return false;
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: h } },
  });
  const { data, error } = await supa.auth.getClaims(h.slice(7));
  if (error || !data?.claims?.sub) return false;
  const { data: roles } = await admin().from("user_roles").select("role").eq("user_id", data.claims.sub);
  return (roles ?? []).some((r: any) => r.role === "admin");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    if (!(await requireAdmin(req))) return jsonResponse({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    if (body?.confirmar !== "PAGAR_1_REAL") return jsonResponse({ error: "confirmacao_ausente" }, 400);

    const cert = normalizePem(Deno.env.get("INTER_PAGAMENTO_CERTIFICADO") ?? "");
    const key = normalizePem(Deno.env.get("INTER_PAGAMENTO_CHAVE_PRIVADA") ?? "");
    // @ts-ignore unstable
    const client = Deno.createHttpClient({ cert, key });
    const origin = new URL(Deno.env.get("INTER_BASE_URL") ?? "https://cdpj.partners.bancointer.com.br").origin;
    const conta = Deno.env.get("INTER_CONTA_CORRENTE") ?? "";

    // 1) OAuth
    const tokRes = await fetch(`${origin}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("INTER_PAGAMENTO_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("INTER_PAGAMENTO_CLIENT_SECRET") ?? "",
        grant_type: "client_credentials",
        scope: "pagamento-pix.write pagamento-pix.read",
      }),
      // @ts-ignore
      client,
    });
    const tokRaw = await tokRes.text();
    if (!tokRes.ok) {
      return jsonResponse({ etapa: "oauth", http_status: tokRes.status, corpo: tokRaw });
    }
    const tok = JSON.parse(tokRaw);

    // 2) Pagamento Pix
    const idempotencia = crypto.randomUUID();
    const payload = {
      valor: VALOR,
      descricao: "Teste API Pagamento Pix Fortem",
      destinatario: { tipo: "CHAVE", chave: CHAVE_DESTINO },
    };
    const payRes = await fetch(`${origin}/banking/v2/pix`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.access_token}`,
        "Content-Type": "application/json",
        "x-conta-corrente": conta,
        "x-id-idempotente": idempotencia,
      },
      body: JSON.stringify(payload),
      // @ts-ignore
      client,
    });
    const payRaw = await payRes.text();
    let corpo: unknown = payRaw;
    try { corpo = JSON.parse(payRaw); } catch { /* keep raw */ }
    console.log("[teste-pagamento-pix]", payRes.status, payRaw);

    return jsonResponse({
      etapa: "pagamento",
      escopo_token: tok.scope,
      id_idempotente: idempotencia,
      payload_enviado: payload,
      http_status: payRes.status,
      corpo,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
