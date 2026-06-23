import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v1",
  producao: "https://api.userede.com.br/erede/v1",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function loadSecrets(supabase: any) {
  const { data } = await supabase.schema("vault").from("decrypted_secrets").select("name, decrypted_secret");
  const m: Record<string, string> = {};
  (data ?? []).forEach((s: any) => { m[s.name] = s.decrypted_secret; });
  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { venda_id, cartao_id, amount, installments = 1 } = await req.json().catch(() => ({}));
  if (!venda_id || !cartao_id || !amount) {
    return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), { status: 400, headers });
  }

  const { data: existing } = await supabase
    .from("pagamentos_rede")
    .select("tid, status")
    .eq("venda_id", venda_id)
    .in("status", ["approved", "pending"])
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ success: true, idempotente: true, tid: existing.tid }), { status: 200, headers });
  }

  const { data: cartao, error: cartaoErr } = await supabase
    .from("cartoes_salvos")
    .select("token_rede, brand, last4, expiration_month, expiration_year, ativo")
    .eq("id", cartao_id).single();
  if (cartaoErr || !cartao?.ativo) {
    return new Response(JSON.stringify({ error: "Cartão inativo ou não encontrado" }), { status: 400, headers });
  }

  const secrets = await loadSecrets(supabase);
  const pv = secrets["rede_pv"], token = secrets["rede_token"];
  const baseUrl = REDE_URLS[secrets["rede_ambiente"] as "sandbox" | "producao"] ?? REDE_URLS.sandbox;

  const payload = {
    capture: true,
    kind: "credit",
    reference: venda_id,
    amount: Math.round(Number(amount) * 100),
    installments,
    storageCard: { cardId: cartao.token_rede },
    subscription: true,
  };

  let redeResponse: any = null;
  try {
    const resp = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: { Authorization: "Bearer " + (await getRedeAccessToken(pv, token, secrets["rede_ambiente"] ?? "sandbox")), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    redeResponse = await resp.json();
  } catch {
    return new Response(JSON.stringify({ error: "Erro de comunicação com a Rede" }), { status: 502, headers });
  }

  const returnCode = redeResponse?.returnCode ?? "XX";
  const approved = returnCode === "00";
  const status = approved ? "approved" : "denied";

  await supabase.from("pagamentos_rede").insert({
    venda_id,
    amount: Math.round(Number(amount) * 100),
    installments,
    kind: "token",
    tid: redeResponse?.tid,
    nsu: redeResponse?.nsu,
    authorization_code: redeResponse?.authorizationCode,
    return_code: returnCode,
    return_message: redeResponse?.returnMessage,
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

  if (returnCode === "54") {
    await supabase.from("cartoes_salvos").update({ ativo: false }).eq("id", cartao_id);
    await supabase.from("planos").update({ cartao_token_id: null }).eq("cartao_token_id", cartao_id);
  }

  return new Response(JSON.stringify({
    success: approved,
    return_code: returnCode,
    return_message: redeResponse?.returnMessage,
    tid: redeResponse?.tid,
  }), { status: 200, headers });
});
