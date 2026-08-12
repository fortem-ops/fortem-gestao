import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function loadSecrets(supabase: any): Promise<Record<string, string>> {
  const m: Record<string, string> = {};

  // 1. Variáveis de ambiente primeiro (Edge Function Secrets — mais confiável)
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

  // 2. Fallback: Supabase Vault
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const authHeader = req.headers.get("Authorization");
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace("Bearer ", "") ?? "");
  if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Apenas admin pode estornar" }), { status: 403, headers });

  const { tid, venda_id, amount } = await req.json().catch(() => ({}));
  if (!tid || !venda_id) {
    return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), { status: 400, headers });
  }

  const secrets = await loadSecrets(supabase);
  const pv = secrets["rede_pv"], token = secrets["rede_token"];
  const ambiente = secrets["rede_ambiente"] as "sandbox" | "producao" ?? "sandbox";
  const baseUrl = REDE_URLS[ambiente] ?? REDE_URLS.sandbox;

  let accessToken: string;
  try {
    accessToken = await getRedeAccessToken(pv, token, ambiente);
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: "Falha na autenticação Rede",
      detalhe: String(e),
    }), { status: 502, headers });
  }

  let redeResponse: any = null;
  let redeStatus = 0;
  let redeBodyText = "";
  try {
    const resp = await fetch(`${baseUrl}/transactions/${tid}/refunds`, {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount ? Math.round(Number(amount) * 100) : undefined }),
    });
    redeStatus = resp.status;
    redeBodyText = await resp.text();
    try { redeResponse = JSON.parse(redeBodyText); } catch { redeResponse = { rawText: redeBodyText }; }
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: "Erro de comunicação com a Rede ao estornar",
      detalhe: String(e),
      rede_http_status: redeStatus,
      rede_body: redeBodyText.slice(0, 1000),
    }), { status: 502, headers });
  }

  const estornado = redeResponse?.returnCode === "00";

  if (estornado) {
    await supabase.from("vendas").update({ status_pagamento: "estornado" }).eq("id", venda_id);
    await supabase.from("pagamentos_rede").update({ status: "refunded" }).eq("tid", tid);
  }

  return new Response(JSON.stringify({
    success: estornado,
    return_code: redeResponse?.returnCode,
    return_message: redeResponse?.returnMessage,
  }), { status: 200, headers });
});