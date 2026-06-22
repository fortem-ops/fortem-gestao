import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const eventId = req.headers.get("x-rede-event-id") ?? req.headers.get("x-event-id");
  if (!eventId) {
    return new Response(JSON.stringify({ error: "event_id ausente" }), { status: 400, headers });
  }

  const body = await req.json().catch(() => ({}));

  const { error: insertErr } = await supabase
    .from("webhook_events_rede")
    .insert({ event_id: eventId, payload: body });

  if (insertErr?.code === "23505") {
    return new Response(JSON.stringify({ ok: true, duplicado: true }), { status: 200, headers });
  }

  const returnCode = body?.returnCode ?? body?.return_code;
  const vendaId = body?.reference ?? body?.orderId;
  const tid = body?.tid;

  if (vendaId && returnCode === "00") {
    await supabase.from("vendas").update({ status_pagamento: "pago" }).eq("id", vendaId);
    if (tid) await supabase.from("pagamentos_rede").update({ status: "approved" }).eq("tid", tid);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
