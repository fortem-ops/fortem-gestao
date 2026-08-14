import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";

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
    const vendaId = typeof body?.venda_id === "string" ? body.venda_id.trim() : "";
    const contratoId = typeof body?.contrato_id === "string" ? body.contrato_id.trim() : null;

    if (!cartaoToken || !vendaId) {
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
    const alunoId = link.aluno_id;

    // ---------- b. cartão tokenizado mais recente ----------
    const { data: tokenizacao } = await supabase
      .from("rede_tokenizacoes")
      .select("tokenization_id, cartao_salvo_id")
      .eq("aluno_id", alunoId)
      .eq("status", "active")
      .not("cartao_salvo_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenizacao?.cartao_salvo_id || !tokenizacao?.tokenization_id) {
      return json(409, { success: false, error: "cartao_ainda_nao_confirmado" });
    }
    const cartaoId = tokenizacao.cartao_salvo_id;

    // ---------- c. venda pertence ao aluno ----------
    const { data: venda } = await supabase
      .from("vendas")
      .select("id, aluno_id, valor_final, parcelas, status_pagamento")
      .eq("id", vendaId)
      .maybeSingle();

    if (!venda) return json(404, { success: false, error: "venda_nao_encontrada" });
    if (venda.aluno_id !== alunoId) {
      console.error("[corrida-cobrar-pedido] venda não pertence ao aluno do token");
      return json(403, { success: false, error: "venda_nao_pertence_ao_token" });
    }

    // ---------- d. contrato aceito ----------
    if (contratoId) {
      const { data: docs } = await supabase
        .from("contratos_documentos")
        .select("id, aceite")
        .eq("contrato_id", contratoId);
      if (!docs?.length || docs.some((d: any) => !d.aceite)) {
        return json(409, { success: false, error: "contrato_nao_aceito" });
      }
    }

    // ---------- e. idempotência ----------
    const { data: existing } = await supabase
      .from("pagamentos_rede")
      .select("tid, status")
      .eq("venda_id", vendaId)
      .in("status", ["approved", "pending"])
      .maybeSingle();
    if (existing) {
      return json(200, { success: true, idempotente: true, tid: existing.tid, return_code: "00" });
    }

    // ---------- f. cobrança na Rede ----------
    const { data: cartao } = await supabase
      .from("cartoes_salvos")
      .select("token_rede, holder_name, expiration_month, expiration_year, ativo")
      .eq("id", cartaoId)
      .maybeSingle();
    if (!cartao?.ativo || !cartao?.token_rede) {
      return json(400, { success: false, error: "cartao_inativo_ou_invalido" });
    }

    const amountReais = Number(venda.valor_final ?? 0);
    const installments = Math.max(1, Number(venda.parcelas ?? 1));
    if (!Number.isFinite(amountReais) || amountReais <= 0) {
      return json(400, { success: false, error: "valor_da_venda_invalido" });
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
      console.error("[corrida-cobrar-pedido] oauth erro:", String(e));
      return json(502, { success: false, error: "falha_autenticacao_rede" });
    }

    // criptograma de uso único
    let cryptoResp: any = null;
    let cryptoStatus = 0;
    try {
      const r = await fetch(`${cryptogramBaseUrl}/${tokenizacao.tokenization_id}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: true }),
      });
      cryptoStatus = r.status;
      const text = await r.text();
      try { cryptoResp = JSON.parse(text); } catch { cryptoResp = { rawText: text.slice(0, 500) }; }
    } catch (e) {
      console.error("[corrida-cobrar-pedido] criptograma fetch erro:", String(e));
      return json(502, { success: false, error: "erro_comunicacao_rede" });
    }

    const cryptoReturnCode = cryptoResp?.returnCode ?? null;
    const tokenCryptogram = cryptoResp?.cryptogramInfo?.tokenCryptogram ?? null;
    if (cryptoStatus < 200 || cryptoStatus >= 300 || cryptoReturnCode !== "00" || !tokenCryptogram) {
      console.error("[corrida-cobrar-pedido] criptograma falhou — http:", cryptoStatus, "returnCode:", cryptoReturnCode);
      try {
        await supabase.from("system_logs").insert({
          modulo: "corrida-cobrar-pedido",
          acao: "criptograma_falhou",
          mensagem: `Falha ao gerar criptograma (tokenizationId ${tokenizacao.tokenization_id}) — HTTP ${cryptoStatus} / returnCode ${cryptoReturnCode ?? "—"}`,
          payload: {
            tokenization_id: tokenizacao.tokenization_id,
            venda_id: vendaId,
            aluno_id: alunoId,
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
      reference: String(vendaId).replace(/-/g, "").slice(0, 20),
      amount: amountCents,
      installments,
      storageCard: "2",
      cardNumber: cartao.token_rede,
      expirationMonth: String(cartao.expiration_month).padStart(2, "0"),
      expirationYear: String(cartao.expiration_year),
      cardholderName: String(cartao.holder_name || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      tokenCryptogram,
      subscription: true,
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
      console.error("[corrida-cobrar-pedido] transação fetch erro:", String(e));
      return json(502, { success: false, error: "erro_comunicacao_rede" });
    }

    const returnCode = redeResponse?.returnCode ?? "XX";
    const approved = returnCode === "00";

    // ---------- g/h. persistência ----------
    await supabase.from("pagamentos_rede").insert({
      venda_id: vendaId,
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
    });

    await supabase
      .from("vendas")
      .update({ status_pagamento: approved ? "pago" : "falha" })
      .eq("id", vendaId);

    if (approved) {
      if (contratoId) {
        await supabase.from("contratos").update({ status: "ativo" }).eq("id", contratoId);
      }
      const { data: vendaPlano } = await supabase
        .from("vendas")
        .select("plano_id")
        .eq("id", vendaId)
        .maybeSingle();
      if (vendaPlano?.plano_id) {
        await supabase.from("planos").update({ cartao_token_id: cartaoId }).eq("id", vendaPlano.plano_id);
      }

      // e-mail de confirmação — fire and forget, nunca afeta o resultado do pagamento
      try {
        supabase.functions
          .invoke("corrida-enviar-confirmacao-email", {
            body: { venda_id: vendaId, contrato_id: contratoId },
          })
          .then((r: any) => {
            if (r?.error) console.error("[corrida-cobrar-pedido] email confirmacao erro:", String(r.error?.message ?? r.error));
          })
          .catch((e: any) => console.error("[corrida-cobrar-pedido] email confirmacao erro:", String(e)));
      } catch (e) {
        console.error("[corrida-cobrar-pedido] email confirmacao erro:", String(e));
      }
    }

    if (returnCode === "54") {
      await supabase.from("cartoes_salvos").update({ ativo: false }).eq("id", cartaoId);
      await supabase.from("planos").update({ cartao_token_id: null }).eq("cartao_token_id", cartaoId);
    }

    return json(200, {
      success: approved,
      return_code: returnCode,
      return_message: redeResponse?.returnMessage ?? null,
      tid: redeResponse?.tid ?? null,
    });
  } catch (err) {
    console.error("corrida-cobrar-pedido error:", err);
    return json(500, { success: false, error: "erro_interno" });
  }
});
