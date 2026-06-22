import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDE_SANDBOX = "https://sandbox-erede.userede.com.br/v1";
const REDE_PROD = "https://api.userede.com.br/erede/v1";
const MAX_TENTATIVAS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function luhn(n: string): boolean {
  const d = n.replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let digit = parseInt(d[i]);
    if (odd) { digit *= 2; if (digit > 9) digit -= 9; }
    s += digit; odd = !odd;
  }
  return s % 10 === 0;
}

function basicAuth(pv: string, token: string) {
  return "Basic " + btoa(`${pv}:${token}`);
}

async function loadSecrets(supabase: any): Promise<Record<string, string>> {
  const m: Record<string, string> = {};

  // Tentativa 1: Supabase Vault
  try {
    const { data, error } = await supabase
      .schema("vault")
      .from("decrypted_secrets")
      .select("name, decrypted_secret")
      .in("name", ["rede_pv", "rede_token", "rede_ambiente"]);

    if (!error && data && data.length > 0) {
      data.forEach((s: any) => { if (s.decrypted_secret) m[s.name] = s.decrypted_secret; });
      console.log("[rede] secrets via Vault:", Object.keys(m).join(", "));
    } else {
      console.warn("[rede] Vault inacessível:", error?.message ?? "sem dados");
    }
  } catch (e) {
    console.warn("[rede] Vault exception:", String(e));
  }

  // Fallback 2: variáveis de ambiente (Supabase Edge Function Secrets)
  if (!m["rede_pv"])       m["rede_pv"]       = Deno.env.get("REDE_PV")       ?? "";
  if (!m["rede_token"])    m["rede_token"]    = Deno.env.get("REDE_TOKEN")    ?? "";
  if (!m["rede_ambiente"]) m["rede_ambiente"] = Deno.env.get("REDE_AMBIENTE") ?? "sandbox";

  console.log("[rede] credenciais carregadas:", {
    pv_ok:     m["rede_pv"].length > 0,
    token_ok:  m["rede_token"].length > 0,
    ambiente:  m["rede_ambiente"],
  });

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

  const { data: ok } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
  if (!ok) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers });

  const body = await req.json().catch(() => null);
  if (!body) return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400, headers });

  const {
    venda_id, aluno_id, card_number, card_holder,
    expiration_month, expiration_year, security_code,
    installments = 1, save_card = false,
  } = body;

  if (!venda_id || !aluno_id || !card_number || !card_holder || !security_code) {
    return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), { status: 400, headers });
  }
  if (!luhn(card_number)) {
    return new Response(JSON.stringify({ error: "Número de cartão inválido" }), { status: 400, headers });
  }

  // Rate limit
  const janela = Math.floor(Date.now() / 60000);
  const { data: rl } = await supabase.rpc("fn_check_rate_limit", {
    p_aluno_id: aluno_id, p_janela: janela, p_limite: MAX_TENTATIVAS,
  });
  if (!rl) {
    return new Response(JSON.stringify({ error: "Limite de tentativas excedido. Tente em 1 minuto." }), { status: 429, headers });
  }

  // Idempotência
  const { data: existing } = await supabase
    .from("pagamentos_rede")
    .select("tid, status")
    .eq("venda_id", venda_id)
    .in("status", ["approved", "pending"])
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ success: true, idempotente: true, tid: existing.tid, status: existing.status }), { status: 200, headers });
  }

  const secrets = await loadSecrets(supabase);
  const pv = secrets["rede_pv"], token = secrets["rede_token"];
  const baseUrl = secrets["rede_ambiente"] === "sandbox" ? REDE_SANDBOX : REDE_PROD;
  if (!pv || !token) {
    return new Response(JSON.stringify({ error: "Credenciais Rede não configuradas" }), { status: 500, headers });
  }

  const { data: venda } = await supabase.from("vendas").select("valor_final").eq("id", venda_id).single();
  const amount = Math.round((Number(venda?.valor_final) || 0) * 100);
  if (amount <= 0) {
    return new Response(JSON.stringify({ error: "Valor da venda inválido" }), { status: 400, headers });
  }

  const cardClean = card_number.replace(/\D/g, "");
  const payload: Record<string, unknown> = {
    capture: true,
    kind: "credit",
    reference: venda_id,
    amount,
    installments,
    cardholderName: card_holder,
    cardNumber: cardClean,
    expirationMonth: String(expiration_month).padStart(2, "0"),
    expirationYear: String(expiration_year),
    securityCode: String(security_code),
  };
  if (save_card) payload.storageCard = { saveCard: true };

  let redeResponse: any = null;
  try {
    const resp = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: { Authorization: basicAuth(pv, token), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    redeResponse = await resp.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erro de comunicação com a Rede", detalhe: String(e) }), { status: 502, headers });
  }

  const returnCode = redeResponse?.returnCode ?? "XX";
  const approved = returnCode === "00";
  const status = approved ? "approved" : "denied";

  await supabase.from("pagamentos_rede").insert({
    venda_id,
    created_by: user.id,
    tid: redeResponse?.tid,
    nsu: redeResponse?.nsu,
    authorization_code: redeResponse?.authorizationCode,
    return_code: returnCode,
    return_message: redeResponse?.returnMessage,
    amount,
    installments,
    kind: "credit",
    status,
    raw_response: redeResponse,
  });

  await supabase.from("vendas").update({ status_pagamento: approved ? "pago" : "falha" }).eq("id", venda_id);

  if (approved) {
    const { data: pagamento } = await supabase.from("pagamentos").select("id").eq("venda_id", venda_id).maybeSingle();
    if (pagamento) {
      await supabase.from("pagamento_parcelas")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("pagamento_id", pagamento.id)
        .eq("status", "pendente");
    }
  }

  if (approved && save_card && redeResponse?.storageCard?.cardId) {
    await supabase.from("cartoes_salvos").insert({
      aluno_id,
      token_rede: redeResponse.storageCard.cardId,
      brand: redeResponse?.brand ?? "unknown",
      last4: cardClean.slice(-4),
      holder_name: card_holder,
      expiration_month: Number(expiration_month),
      expiration_year: Number(expiration_year),
      is_default: true,
    });
  }

  return new Response(JSON.stringify({
    success: approved,
    return_code: returnCode,
    return_message: redeResponse?.returnMessage,
    tid: redeResponse?.tid,
  }), { status: 200, headers });
});
