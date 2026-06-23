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
  const baseUrl = REDE_URLS[secrets["rede_ambiente"] as "sandbox" | "producao"] ?? REDE_URLS.sandbox;

  const resp = await fetch(`${baseUrl}/transactions/${tid}/refunds`, {
    method: "POST",
    headers: { Authorization: "Bearer " + (await getRedeAccessToken(pv, token, secrets["rede_ambiente"] ?? "sandbox")), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amount ? Math.round(Number(amount) * 100) : undefined }),
  });
  const redeResponse = await resp.json();
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
