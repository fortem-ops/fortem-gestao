import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

const TOKEN_SERVICE_URLS = {
  sandbox:  "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function loadSecrets(supabase: any): Promise<Record<string, string>> {
  const m: Record<string, string> = {};

  const envPv      = Deno.env.get("REDE_PV")       ?? "";
  const envToken   = Deno.env.get("REDE_TOKEN")    ?? "";
  const envAmbient = Deno.env.get("REDE_AMBIENTE") ?? "";

  if (envPv)      m["rede_pv"]       = envPv;
  if (envToken)   m["rede_token"]    = envToken;
  if (envAmbient) m["rede_ambiente"] = envAmbient;

  if (m["rede_pv"] && m["rede_token"]) {
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
    }
  } catch { /* ignore */ }

  if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";
  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), { status: 405, headers });
  }

  // 1. Autenticação do webhook
  const expected = Deno.env.get("REDE_WEBHOOK_TOKEN") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !provided || provided !== expected) {
    console.warn("[rede-tokenizacao-webhook] autenticação inválida");
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers });
  }

  // 2. Parse do payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400, headers });
  }

  const tokenizationId = body?.data?.tokenizationId ?? body?.tokenizationId ?? null;
  console.log("[rede-tokenizacao-webhook] evento recebido:", JSON.stringify({
    id: body?.id ?? null,
    merchant_id: body?.merchant_id ?? null,
    events: body?.events ?? null,
    tokenizationId,
  }));

  if (!tokenizationId) {
    return new Response(JSON.stringify({ error: "tokenizationId ausente" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3/4/5/6. Processamento (síncrono, mas rápido) — respondemos 200 ao final
  try {
    const secrets = await loadSecrets(supabase);
    const ambiente = secrets["rede_ambiente"] === "producao" ? "producao" : "sandbox";
    const baseUrl = TOKEN_SERVICE_URLS[ambiente];

    const accessToken = await getRedeAccessToken(
      String(secrets["rede_pv"] ?? "").trim(),
      String(secrets["rede_token"] ?? "").trim(),
      ambiente,
    );

    const r = await fetch(`${baseUrl}/${tokenizationId}`, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    });
    const text = await r.text();
    let consulta: any;
    try { consulta = JSON.parse(text); } catch { consulta = { rawText: text }; }
    console.log("[rede-tokenizacao-webhook] consulta status:", r.status, "body:", JSON.stringify(consulta));

    const statusRede = String(consulta?.tokenizationStatus ?? "").trim();
    const statusLower = statusRede.toLowerCase();

    const update: Record<string, unknown> = {
      status: statusLower || "pending",
      brand_name: consulta?.brand?.name ?? null,
      brand_tid: consulta?.brand?.brandTid ?? null,
      bin: consulta?.bin ?? null,
      last4: consulta?.last4 ?? null,
      token_code: consulta?.token?.code ?? null,
      token_expiration: consulta?.token?.expirationDate ?? null,
      raw_response: consulta,
      updated_at: new Date().toISOString(),
    };

    const { data: registro, error: updErr } = await supabase
      .from("rede_tokenizacoes")
      .update(update)
      .eq("tokenization_id", tokenizationId)
      .select("id, aluno_id, origem, cartao_salvo_id")
      .maybeSingle();

    if (updErr) {
      console.error("[rede-tokenizacao-webhook] erro ao atualizar registro:", updErr.message);
    }

    if (statusRede === "Active" && registro && !registro.cartao_salvo_id) {
      const { data: cartao, error: insErr } = await supabase
        .from("cartoes_salvos")
        .insert({
          aluno_id: registro.aluno_id,
          token_rede: consulta?.token?.code ?? null,
          brand: consulta?.brand?.name ?? null,
          last4: consulta?.last4 ?? null,
          holder_name: null,
          ativo: true,
          is_default: false,
          origem: registro.origem ?? "tokenizacao_bandeira",
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("[rede-tokenizacao-webhook] erro ao inserir cartão:", insErr.message);
      } else if (cartao?.id) {
        await supabase
          .from("rede_tokenizacoes")
          .update({ cartao_salvo_id: cartao.id, updated_at: new Date().toISOString() })
          .eq("id", registro.id);
        console.log("[rede-tokenizacao-webhook] cartão salvo:", cartao.id);
      }
    }

    if (statusRede === "Failed") {
      try {
        await supabase.from("system_logs").insert({
          modulo: "rede-tokenizacao-webhook",
          acao: "tokenizacao_falhou",
          mensagem: consulta?.brand?.message ?? "Tokenização de bandeira falhou",
          payload: {
            tokenization_id: tokenizationId,
            aluno_id: registro?.aluno_id ?? null,
            origem: registro?.origem ?? null,
            tokenization_status: statusRede,
            brand: consulta?.brand ?? null,
            bin: consulta?.bin ?? null,
            last4: consulta?.last4 ?? null,
            raw_response: consulta,
          },
        });
      } catch (e) {
        console.error("[rede-tokenizacao-webhook] falha ao registrar system_logs:", String(e));
      }
    }

    return new Response(JSON.stringify({ received: true, status: statusLower || "pending" }), { status: 200, headers });
  } catch (e) {
    console.error("[rede-tokenizacao-webhook] erro no processamento:", String(e));
    // Ainda respondemos 200 para evitar retentativas em loop da Rede
    return new Response(JSON.stringify({ received: true, processed: false }), { status: 200, headers });
  }
});
