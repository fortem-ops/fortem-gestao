import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadSecrets,
  mapReturnCode,
  resolveRedeBaseUrl,
} from "../_shared/rede-payload.ts";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Comparação em tempo constante: percorre todos os bytes acumulando XOR, sem short-circuit. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── 2. Autenticação de origem ──────────────────────────────
  const expectedToken = Deno.env.get("REDE_TX_WEBHOOK_TOKEN") ?? "";
  if (!expectedToken) {
    console.error("[rede-webhook] REDE_TX_WEBHOOK_TOKEN não configurado — recusando (fail closed)");
    return new Response(JSON.stringify({ error: "webhook não configurado" }), { status: 500, headers });
  }

  const url = new URL(req.url);
  const receivedToken = req.headers.get("x-webhook-token") ?? url.searchParams.get("token") ?? "";
  if (!receivedToken || !timingSafeEqualStr(receivedToken, expectedToken)) {
    console.warn("[rede-webhook] tentativa com token ausente ou inválido (token não logado)");
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401, headers });
  }

  const body = await req.json().catch(() => ({}));
  const tid = body?.tid;
  const returnCodeBody = body?.returnCode ?? body?.return_code;

  // ── 3. Idempotência ────────────────────────────────────────
  const eventId =
    req.headers.get("x-rede-event-id") ??
    req.headers.get("x-event-id") ??
    body?.eventId ??
    `${tid ?? "sem-tid"}-${returnCodeBody ?? "sem-rc"}`;

  // ── 4. Gravação do evento ──────────────────────────────────
  const { error: insertErr } = await supabase
    .from("webhook_events_rede")
    .insert({ event_id: eventId, payload: body });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicado: true }), { status: 200, headers });
    }
    console.error("[rede-webhook] falha ao gravar evento:", insertErr.message);
    return new Response(JSON.stringify({ error: "falha ao registrar evento" }), { status: 500, headers });
  }

  // ── 5. Confirmação ativa na Rede ───────────────────────────
  if (!tid) {
    return new Response(JSON.stringify({ ok: true, ignorado: "sem tid" }), { status: 200, headers });
  }

  const secrets = await loadSecrets(supabase);
  const ambiente = secrets["rede_ambiente"] ?? "sandbox";

  let tx: any;
  try {
    const accessToken = await getRedeAccessToken(secrets["rede_pv"], secrets["rede_token"], ambiente);
    const resp = await fetch(`${resolveRedeBaseUrl(ambiente)}/transactions/${tid}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[rede-webhook] consulta à Rede falhou (${resp.status}):`, text.slice(0, 300));
      return new Response(JSON.stringify({ error: "falha ao consultar Rede" }), { status: 500, headers });
    }
    tx = await resp.json();
  } catch (e) {
    console.error("[rede-webhook] exceção ao consultar Rede:", String(e));
    return new Response(JSON.stringify({ error: "falha ao consultar Rede" }), { status: 500, headers });
  }

  // ── 6. Decisão baseada SOMENTE na resposta da consulta ─────
  const rc = mapReturnCode(tx?.returnCode);
  const vendaId = tx?.reference;
  let vendaAtualizada = false;

  if (rc.approved) {
    if (vendaId) {
      const { error } = await supabase
        .from("vendas")
        .update({ status_pagamento: "pago" })
        .eq("id", vendaId);
      if (error) console.error("[rede-webhook] erro ao atualizar venda:", error.message);
      else vendaAtualizada = true;
    }
    await supabase.from("pagamentos_rede").update({ status: "approved" }).eq("tid", tid);
  } else {
    // Não tocar em `vendas` — apenas marca a tentativa como negada, sem rebaixar approved.
    await supabase
      .from("pagamentos_rede")
      .update({ status: "denied" })
      .eq("tid", tid)
      .neq("status", "approved");
  }

  console.log("[rede-webhook] processado:", {
    tid,
    returnCode: rc.returnCode,
    aprovado: rc.approved,
    vendaAtualizada,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
