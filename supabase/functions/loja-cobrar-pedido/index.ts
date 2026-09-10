import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { checkRateLimit } from "../_shared/loja-rate-limit.ts";

const REDE_URLS = {
  sandbox: "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};

const TOKEN_SERVICE_URLS = {
  sandbox: "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/cryptogram",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/cryptogram",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(supabase, req, "cobrar-pedido", 5, 60);
    if (!ok) return json(429, { success: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const cartaoToken = typeof body?.cartao_token === "string" ? body.cartao_token.trim() : "";
    const pedidoId = typeof body?.pedido_id === "string" ? body.pedido_id.trim() : "";
    const parcelasBody = Number(body?.parcelas ?? 1);

    if (!cartaoToken || !pedidoId) {
      return json(400, { success: false, error: "campos_obrigatorios_ausentes" });
    }

    // ---------- a. validar token de checkout ----------
    const { data: link } = await supabase
      .from("links_cartao")
      .select("id, aluno_id, usado, expira_em")
      .eq("token", cartaoToken)
      .maybeSingle();

    if (!link) return json(404, { success: false, error: "token_invalido" });
    if (new Date(link.expira_em).getTime() < Date.now()) {
      return json(410, { success: false, error: "token_expirado" });
    }
    if (!link.usado) {
      return json(409, { success: false, error: "cartao_ainda_nao_cadastrado" });
    }
    const compradorId = link.aluno_id;

    // ---------- b. cartão tokenizado mais recente ----------
    const { data: tokenizacao } = await supabase
      .from("rede_tokenizacoes")
      .select("tokenization_id, cartao_salvo_id")
      .eq("aluno_id", compradorId)
      .eq("status", "active")
      .not("cartao_salvo_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenizacao?.cartao_salvo_id || !tokenizacao?.tokenization_id) {
      return json(409, { success: false, error: "cartao_ainda_nao_confirmado" });
    }
    const cartaoId = tokenizacao.cartao_salvo_id;

    // ---------- c. pedido ----------
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, status, valor_final, cobranca_id")
      .eq("id", pedidoId)
      .maybeSingle();

    if (!pedido) return json(404, { success: false, error: "pedido_nao_encontrado" });
    if (pedido.status === "pago") {
      return json(200, { success: true, idempotente: true, return_code: "00" });
    }
    if (pedido.status !== "aguardando_pagamento") {
      return json(409, { success: false, error: "pedido_nao_pagavel" });
    }

    // ---------- d. idempotência ----------
    const { data: existing } = await supabase
      .from("pagamentos_rede")
      .select("id, tid, status")
      .eq("cobranca_id", pedidoId)
      .in("status", ["approved", "pending"])
      .maybeSingle();
    if (existing) {
      return json(200, { success: true, idempotente: true, tid: existing.tid, return_code: "00" });
    }

    // ---------- e. cobrança na Rede ----------
    const { data: cartao } = await supabase
      .from("cartoes_salvos")
      .select("token_rede, holder_name, expiration_month, expiration_year, ativo")
      .eq("id", cartaoId)
      .maybeSingle();
    if (!cartao?.ativo || !cartao?.token_rede) {
      return json(400, { success: false, error: "cartao_inativo_ou_invalido" });
    }

    const amountReais = Number(pedido.valor_final ?? 0);
    const installments = Math.max(1, Number.isFinite(parcelasBody) ? Math.trunc(parcelasBody) : 1);
    if (!Number.isFinite(amountReais) || amountReais <= 0) {
      return json(400, { success: false, error: "valor_do_pedido_invalido" });
    }
    const amountCents = Math.round(amountReais * 100);

    const pv = (Deno.env.get("REDE_PV") ?? "").trim();
    const redeToken = (Deno.env.get("REDE_TOKEN") ?? "").trim();
    const ambiente = ((Deno.env.get("REDE_AMBIENTE") ?? "sandbox").trim() as "sandbox" | "producao");
    if (!pv || !redeToken) return json(500, { success: false, error: "credenciais_rede_ausentes" });

    const baseUrl = REDE_URLS[ambiente] ?? REDE_URLS.sandbox;
    const cryptogramBaseUrl = TOKEN_SERVICE_URLS[ambiente] ?? TOKEN_SERVICE_URLS.sandbox;

    let accessToken: string;
    try {
      accessToken = await getRedeAccessToken(pv, redeToken, ambiente);
    } catch (e) {
      console.error("[loja-cobrar-pedido] oauth erro:", String(e));
      return json(502, { success: false, error: "falha_autenticacao_rede" });
    }

    // criptograma de uso único
    let cryptoResp: any = null;
    let cryptoStatus = 0;
    try {
      const r = await fetch(`${cryptogramBaseUrl}/${tokenizacao.tokenization_id}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: false }),
      });
      cryptoStatus = r.status;
      const text = await r.text();
      try { cryptoResp = JSON.parse(text); } catch { cryptoResp = { rawText: text.slice(0, 500) }; }
    } catch (e) {
      console.error("[loja-cobrar-pedido] criptograma fetch erro:", String(e));
      return json(502, { success: false, error: "erro_comunicacao_rede" });
    }

    const cryptoReturnCode = cryptoResp?.returnCode ?? null;
    const tokenCryptogram = cryptoResp?.cryptogramInfo?.tokenCryptogram ?? null;
    if (cryptoStatus < 200 || cryptoStatus >= 300 || cryptoReturnCode !== "00" || !tokenCryptogram) {
      console.error("[loja-cobrar-pedido] criptograma falhou — http:", cryptoStatus, "returnCode:", cryptoReturnCode);
      try {
        await supabase.from("system_logs").insert({
          modulo: "loja-cobrar-pedido",
          acao: "criptograma_falhou",
          mensagem: `Falha ao gerar criptograma (tokenizationId ${tokenizacao.tokenization_id}) — HTTP ${cryptoStatus} / returnCode ${cryptoReturnCode ?? "—"}`,
          payload: {
            tokenization_id: tokenizacao.tokenization_id,
            pedido_id: pedidoId,
            http_status: cryptoStatus,
            return_code: cryptoReturnCode,
            return_message: cryptoResp?.returnMessage ?? null,
          },
        });
      } catch { /* ignore */ }
      return json(502, {
        success: false,
        error: "falha_criptograma",
        return_code: cryptoReturnCode,
        return_message: cryptoResp?.returnMessage ?? null,
      });
    }

    const payload = {
      capture: true,
      kind: "credit",
      reference: String(pedidoId).replace(/-/g, "").slice(0, 20),
      amount: amountCents,
      installments,
      storageCard: "2",
      cardNumber: cartao.token_rede,
      expirationMonth: String(cartao.expiration_month).padStart(2, "0"),
      expirationYear: String(cartao.expiration_year),
      cardholderName: String(cartao.holder_name || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      tokenCryptogram,
    };

    let redeResponse: any = null;
    try {
      const r = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      try { redeResponse = JSON.parse(text); } catch { redeResponse = { rawText: text.slice(0, 500) }; }
    } catch (e) {
      console.error("[loja-cobrar-pedido] transação fetch erro:", String(e));
      return json(502, { success: false, error: "erro_comunicacao_rede" });
    }

    const returnCode = redeResponse?.returnCode ?? "XX";
    const approved = returnCode === "00";

    // ---------- f. persistência ----------
    const { data: pagamento } = await supabase
      .from("pagamentos_rede")
      .insert({
        cobranca_id: pedidoId,
        amount: amountCents,
        installments,
        kind: "token",
        tid: redeResponse?.tid,
        nsu: redeResponse?.nsu,
        authorization_code: redeResponse?.authorizationCode,
        return_code: returnCode,
        return_message: redeResponse?.returnMessage,
        status: approved ? "approved" : "denied",
        raw_response: redeResponse,
      })
      .select("id")
      .maybeSingle();

    if (approved) {
      // estoque permanece baixado (reserva vira venda)
      await supabase
        .from("pedidos")
        .update({
          status: "pago",
          forma_pagamento: "cartao_credito",
          cobranca_id: pagamento?.id ?? null,
        })
        .eq("id", pedidoId);
    } else {
      await supabase
        .from("pedidos")
        .update({ status: "cancelado", cobranca_id: pagamento?.id ?? null })
        .eq("id", pedidoId);

      const { error: revErr } = await supabase.rpc("fn_loja_reverter_reserva", { p_pedido_id: pedidoId });
      if (revErr) {
        console.error("[loja-cobrar-pedido] falha ao reverter reserva:", revErr.message);
        try {
          await supabase.from("system_logs").insert({
            modulo: "loja-cobrar-pedido",
            acao: "reversao_reserva_falhou",
            mensagem: `Pagamento recusado, mas o estoque reservado do pedido ${pedidoId} não pôde ser devolvido.`,
            payload: { pedido_id: pedidoId, erro: revErr.message },
          });
        } catch { /* ignore */ }
      }
    }

    if (returnCode === "54") {
      await supabase.from("cartoes_salvos").update({ ativo: false }).eq("id", cartaoId);
    }

    return json(200, {
      success: approved,
      return_code: returnCode,
      return_message: redeResponse?.returnMessage ?? null,
      tid: redeResponse?.tid ?? null,
      pedido_id: pedidoId,
    });
  } catch (err) {
    console.error("loja-cobrar-pedido error:", err);
    return json(500, { success: false, error: "erro_interno" });
  }
});
