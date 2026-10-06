import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadSecrets,
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

/** Token pelo caminho: último segmento depois de "rede-webhook" (a Rede não permite header custom). */
function tokenFromPath(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.lastIndexOf("rede-webhook");
  if (idx >= 0 && idx < segments.length - 1) {
    return segments[segments.length - 1];
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Autenticação de origem ─────────────────────────────────
  const expectedToken = Deno.env.get("REDE_TX_WEBHOOK_TOKEN") ?? "";
  if (!expectedToken) {
    console.error("[rede-webhook] REDE_TX_WEBHOOK_TOKEN não configurado — recusando (fail closed)");
    return new Response(JSON.stringify({ error: "webhook não configurado" }), { status: 500, headers });
  }

  const url = new URL(req.url);
  const receivedToken =
    req.headers.get("x-webhook-token") ??
    url.searchParams.get("token") ??
    tokenFromPath(url) ??
    "";
  if (!receivedToken || !timingSafeEqualStr(receivedToken, expectedToken)) {
    console.warn("[rede-webhook] tentativa com token ausente ou inválido (token não logado)");
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401, headers });
  }

  const body = await req.json().catch(() => ({}));
  const tid = body?.tid;
  const refundIdBody = body?.refundId;
  const cancellationNotice = body?.cancellationNotice;
  const dateBody = body?.date;

  // ── Idempotência (chave determinística, distingue estornos parciais) ──
  const eventId =
    req.headers.get("x-rede-event-id") ??
    req.headers.get("x-event-id") ??
    body?.eventId ??
    (refundIdBody
      ? `refund-${tid ?? "sem-tid"}-${refundIdBody}`
      : cancellationNotice
        ? `refund-${tid ?? "sem-tid"}-${cancellationNotice}`
        : `refund-${tid ?? "sem-tid"}-${dateBody ?? "sem-data"}`);

  // ── Gravação do evento ─────────────────────────────────────
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

  // ── Sem tid: nada a consultar ──────────────────────────────
  if (!tid) {
    return new Response(JSON.stringify({ ok: true, ignorado: "sem tid" }), { status: 200, headers });
  }

  // ── Só tratamos eventos de estorno/cancelamento ────────────
  const type = String(body?.type ?? "").toLowerCase();
  if (type && type !== "refund") {
    return new Response(JSON.stringify({ ok: true, ignorado: "evento não tratado" }), { status: 200, headers });
  }

  // ── Confirmação ativa na Rede ──────────────────────────────
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

  // ── Decisão baseada SOMENTE na resposta da consulta ────────
  const authorization = tx?.authorization ?? {};
  const refundsRaw = tx?.refunds;
  const refunds: any[] = Array.isArray(refundsRaw)
    ? refundsRaw
    : refundsRaw
      ? [refundsRaw]
      : [];

  const totalTransacao = Number(authorization.amount) || 0;
  const totalEstornado = refunds
    .filter((r) => r?.status === "Done")
    .reduce((acc, r) => acc + (Number(r?.amount) || 0), 0);
  const cancelada = authorization.status === "Canceled";
  const estornoTotal =
    cancelada || (totalEstornado > 0 && totalTransacao > 0 && totalEstornado >= totalTransacao);
  const estornoParcial = totalEstornado > 0 && !estornoTotal;
  const vendaId = authorization.reference;

  let caminho: "total" | "parcial" | "sem_efeito";

  if (estornoTotal) {
    caminho = "total";
    if (vendaId) {
      const { error } = await supabase
        .from("vendas")
        .update({ status_pagamento: "estornado" })
        .eq("id", vendaId);
      if (error) console.error("[rede-webhook] erro ao atualizar venda:", error.message);
    }
    // Nunca rebaixar um refunded existente: só marca quem ainda não está refunded.
    await supabase
      .from("pagamentos_rede")
      .update({ status: "refunded" })
      .eq("tid", tid)
      .neq("status", "refunded");
  } else if (estornoParcial) {
    caminho = "parcial";
    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-webhook",
        acao: "estorno_parcial",
        mensagem: `Estorno parcial na transação ${tid}: ${totalEstornado} de ${totalTransacao}`,
        payload: {
          tid,
          venda_id: vendaId,
          total_transacao: totalTransacao,
          total_estornado: totalEstornado,
          authorization_status: authorization.status,
          refunds,
        },
      });
    } catch (e) {
      console.error("[rede-webhook] falha ao gravar system_logs (estorno_parcial):", String(e));
    }
  } else {
    caminho = "sem_efeito";
    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-webhook",
        acao: "estorno_sem_efeito",
        mensagem: `Notificação de estorno sem efeito na transação ${tid}: ${totalEstornado} de ${totalTransacao}`,
        payload: {
          tid,
          venda_id: vendaId,
          total_transacao: totalTransacao,
          total_estornado: totalEstornado,
          authorization_status: authorization.status,
          refunds,
        },
      });
    } catch (e) {
      console.error("[rede-webhook] falha ao gravar system_logs (estorno_sem_efeito):", String(e));
    }
  }

  console.log("[rede-webhook] processado:", {
    tid,
    authorizationStatus: authorization.status,
    totalTransacao,
    totalEstornado,
    caminho,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
