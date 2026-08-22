import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import {
  loadSecrets,
  resolveRedeBaseUrl,
  resolveTokenServiceUrl,
  toCentavos,
  buildReference,
  normalizeCardholderName,
  formatExpirationMonth,
} from "../_shared/rede-payload.ts";
import { cobrarComToken } from "../_shared/rede-recorrencia-core.ts";

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
    .select("token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo")
    .eq("id", cartao_id).single();
  if (cartaoErr || !cartao?.ativo) {
    return new Response(JSON.stringify({ error: "Cartão inativo ou não encontrado" }), { status: 400, headers });
  }

  // Buscar tokenization_id ativo correspondente a este cartão salvo
  const { data: tokenizacao } = await supabase
    .from("rede_tokenizacoes")
    .select("tokenization_id")
    .eq("cartao_salvo_id", cartao_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tokenizacao?.tokenization_id) {
    return new Response(JSON.stringify({ error: "Token de cobrança não encontrado para este cartão. É necessário recadastrar o cartão." }), { status: 400, headers });
  }

  const secrets = await loadSecrets(supabase);
  const pv = secrets["rede_pv"], token = secrets["rede_token"];
  const ambiente = (secrets["rede_ambiente"] as "sandbox" | "producao") ?? "sandbox";
  const baseUrl = resolveRedeBaseUrl(ambiente);
  const tokenServiceBaseUrl = resolveTokenServiceUrl(ambiente);

  // Gerar access_token OAuth e criptograma de uso único
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

  // Núcleo compartilhado: criptograma + transação + interpretação do returnCode.
  const resultado = await cobrarComToken({
    tokenizationId: tokenizacao.tokenization_id,
    amountCentavos: toCentavos(amount),
    installments,
    reference: buildReference(venda_id),
    cardNumber: cartao.token_rede,
    cardholderName: normalizeCardholderName(cartao.holder_name),
    expirationMonth: formatExpirationMonth(cartao.expiration_month),
    expirationYear: String(cartao.expiration_year),
    accessToken,
    baseUrl,
    tokenServiceBaseUrl,
  });

  if (resultado.stage === "cryptogram" && resultado.errorKind === "network") {
    return new Response(JSON.stringify({
      success: false,
      error: "Erro de comunicação com a Rede ao gerar criptograma",
      detalhe: resultado.error,
      rede_http_status: resultado.httpStatus,
      rede_body: "",
    }), { status: 502, headers });
  }

  if (resultado.stage === "cryptogram") {
    console.error(
      "[rede-cobrar-token] criptograma falhou — http:", resultado.httpStatus,
      "returnCode:", resultado.returnCode,
      "returnMessage:", resultado.returnMessage,
    );
    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-cobrar-token",
        acao: "criptograma_falhou",
        mensagem: `Falha ao gerar criptograma (tokenizationId ${tokenizacao.tokenization_id}) — HTTP ${resultado.httpStatus} / returnCode ${resultado.returnCode ?? "—"}`,
        payload: {
          tokenization_id: tokenizacao.tokenization_id,
          venda_id,
          cartao_id,
          return_code: resultado.returnCode,
          return_message: resultado.returnMessage,
          http_status: resultado.httpStatus,
          raw_response: resultado.raw,
        },
      });
    } catch (e) {
      console.error("[rede-cobrar-token] falha ao registrar system_logs do criptograma:", String(e));
    }
    return new Response(JSON.stringify({
      success: false,
      error: resultado.error,
      return_code: resultado.returnCode,
      rede_http_status: resultado.httpStatus,
      rede_body: resultado.raw,
    }), { status: 502, headers });
  }

  if (resultado.errorKind === "network") {
    return new Response(JSON.stringify({
      success: false,
      error: "Erro de comunicação com a Rede",
      detalhe: resultado.error,
      rede_http_status: resultado.httpStatus,
      rede_body: "",
    }), { status: 502, headers });
  }

  const { approved, returnCode, desativarCartao } = resultado;

  await supabase.from("pagamentos_rede").insert({
    venda_id,
    amount: toCentavos(amount),
    installments,
    kind: "token",
    tid: resultado.tid,
    nsu: resultado.nsu,
    authorization_code: resultado.authorizationCode,
    return_code: returnCode,
    return_message: resultado.returnMessage,
    status: approved ? "approved" : "denied",
    raw_response: resultado.raw,
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

  if (desativarCartao) {
    await supabase.from("cartoes_salvos").update({ ativo: false }).eq("id", cartao_id);
    await supabase.from("planos").update({ cartao_token_id: null }).eq("cartao_token_id", cartao_id);
  }

  return new Response(JSON.stringify({
    success: approved,
    return_code: returnCode,
    return_message: resultado.returnMessage,
    tid: resultado.tid,
  }), { status: 200, headers });
});
