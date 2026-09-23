import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { executarRefundRede, loadRedeSecrets, redeBaseUrl } from "../_shared/rede-refund.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

  // Valor do estorno em centavos: body (reais) ou fallback em pagamentos_rede (já em centavos)
  let amountCents: number | null =
    amount != null && Number(amount) > 0 ? Math.round(Number(amount) * 100) : null;

  if (!amountCents) {
    const { data: pag } = await supabase
      .from("pagamentos_rede")
      .select("amount")
      .eq("tid", tid)
      .maybeSingle();
    if (pag?.amount && Number(pag.amount) > 0) amountCents = Math.round(Number(pag.amount));
  }

  if (!amountCents || amountCents <= 0) {
    return new Response(JSON.stringify({
      success: false,
      error: "Valor do estorno não informado e não encontrado para este TID",
    }), { status: 400, headers });
  }

  const { pv, token, ambiente } = await loadRedeSecrets(supabase);
  const baseUrl = redeBaseUrl(ambiente);

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

  const r = await executarRefundRede({
    accessToken,
    baseUrl,
    tid,
    amountCents,
    logPrefix: "[rede-cancelar]",
  });

  if (r.transportError) {
    return new Response(JSON.stringify({
      success: false,
      error: "Erro de comunicação com a Rede ao estornar",
      detalhe: r.transportError,
      rede_http_status: r.httpStatus,
      rede_body: r.rawText.slice(0, 1000),
    }), { status: 502, headers });
  }

  console.log(
    `[rede-cancelar] resposta Rede http=${r.httpStatus} returnCode=${r.returnCode ?? "-"} returnMessage=${r.returnMessage ?? r.rawText.slice(0, 300)}`,
  );

  if (r.ok) {
    await supabase.from("vendas").update({ status_pagamento: "estornado" }).eq("id", venda_id);
    await supabase.from("pagamentos_rede").update({ status: "refunded" }).eq("tid", tid);
  }

  return new Response(JSON.stringify({
    success: r.ok,
    return_code: r.returnCode,
    return_message: r.returnMessage ?? (r.ok ? undefined : r.rawText.slice(0, 300)),
    ...(r.ok ? {} : {
      rede_http_status: r.httpStatus,
      rede_body: r.rawText.slice(0, 1000),
    }),
  }), { status: 200, headers });
});
