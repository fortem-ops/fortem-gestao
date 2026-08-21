import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import {
  loadSecrets,
  luhn,
  resolveRedeBaseUrl,
  calcularAmountCentavos,
  isRecorrencia as isVendaRecorrencia,
  normalizarPeriodoMeses,
  buildReference,
  normalizeCardholderName,
  formatExpirationMonth,
  formatExpirationYear,
  mapReturnCode,
} from "../_shared/rede-payload.ts";

const MAX_TENTATIVAS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // ── ENDPOINT DE DIAGNÓSTICO (GET /rede-cobrar-cartao/ping) ──
  if (req.method === "GET") {
    const supabaseDiag = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const secrets = await loadSecrets(supabaseDiag, { verbose: true });
    const pv    = secrets["rede_pv"]    ?? "";
    const token = secrets["rede_token"] ?? "";

    const ambiente = secrets["rede_ambiente"] ?? "sandbox";
    const baseUrl = resolveRedeBaseUrl(ambiente);

    let oauthTest = "não testado";
    let accessTokenForTest: string | null = null;
    try {
      accessTokenForTest = await getRedeAccessToken(pv.trim(), token.trim(), ambiente);
      oauthTest = accessTokenForTest
        ? "OK — token obtido (" + accessTokenForTest.slice(0, 8) + "...)"
        : "falhou";
    } catch (e) {
      oauthTest = "erro: " + String(e).slice(0, 200);
    }

    // Bearer (OAuth) GET sondagem
    let redeTestStatus = 0;
    let redeTestBody   = "";
    try {
      const authHeader = accessTokenForTest
        ? "Bearer " + accessTokenForTest
        : "Bearer (sem token)";
      const resp = await fetch(`${baseUrl}/transactions?reference=ping-test`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      });
      redeTestStatus = resp.status;
      redeTestBody   = (await resp.text()).slice(0, 300);
    } catch (e) {
      redeTestBody = "fetch error: " + String(e);
    }

    // Basic Auth GET sondagem (PV:Token)
    let basicTestStatus = 0;
    let basicTestBody   = "";
    try {
      const basic = btoa(`${pv.trim()}:${token.trim()}`);
      const resp = await fetch(`${baseUrl}/transactions?reference=ping-test`, {
        method: "GET",
        headers: {
          "Authorization": "Basic " + basic,
          "Content-Type":  "application/json",
        },
      });
      basicTestStatus = resp.status;
      basicTestBody   = (await resp.text()).slice(0, 300);
    } catch (e) {
      basicTestBody = "fetch error: " + String(e);
    }

    return new Response(JSON.stringify({
      ok: true,
      pv_length:        pv.length,
      pv_trimmed:       pv === pv.trim(),
      pv_first2:        pv.slice(0, 2),
      pv_last2:         pv.slice(-2),
      token_length:     token.length,
      token_trimmed:    token === token.trim(),
      token_first4:     token.slice(0, 4),
      token_last4:      token.slice(-4),
      ambiente,
      rede_url:         baseUrl,
      oauth_test:       oauthTest,
      bearer_test_http: redeTestStatus,
      bearer_test_body: redeTestBody,
      basic_test_http:  basicTestStatus,
      basic_test_body:  basicTestBody,
    }), { headers });
  }


  // ── COBRANÇA (POST) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Rate limit ANTES do auth — protege contra brute-force mesmo sem JWT válido
  const bodyText = await req.text();
  let bodyParsed: any = null;
  try { bodyParsed = JSON.parse(bodyText); } catch { /* ignore */ }

  const alunoIdRL = bodyParsed?.aluno_id;
  console.log("[rate-limit] aluno_id:", alunoIdRL, "bodyKeys:", bodyParsed ? Object.keys(bodyParsed) : null);
  if (alunoIdRL && /^[0-9a-f-]{36}$/i.test(alunoIdRL)) {
    const janelaRL = Math.floor(Date.now() / 60000);
    const { data: rlOk, error: rlErr } = await supabase.rpc("fn_check_rate_limit", {
      p_aluno_id: alunoIdRL,
      p_janela:   janelaRL,
      p_limite:   MAX_TENTATIVAS,
    });
    console.log("[rate-limit] rpc result:", { rlOk, rlErr: rlErr?.message, janela: janelaRL });
    if (!rlOk) {
      return new Response(
        JSON.stringify({ error: "Limite de tentativas excedido. Aguarde 1 minuto." }),
        { status: 429, headers }
      );
    }
  }


  const authHeader = req.headers.get("Authorization");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "") ?? ""
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });
  }

  const { data: ok } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
  if (!ok) {
    return new Response(JSON.stringify({ error: "Sem permissão — necessário coord ou admin" }), { status: 403, headers });
  }

  const body = bodyParsed;
  if (!body) {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400, headers });
  }

  const {
    venda_id, aluno_id, card_number, card_holder,
    expiration_month, expiration_year, security_code,
    installments = 1, save_card = false,
    origem = "recepcao",
    auth_mode = "bearer",        // "bearer" | "basic" — diagnóstico
    capture_override,             // boolean opcional — força capture
    servicos_inclusos = null,    // { avaliacao_funcional, nutricao, reabilitacao, definir_depois }
  } = body;



  // Validações básicas
  if (!venda_id || !aluno_id || !card_number || !card_holder || !security_code || !expiration_month || !expiration_year) {
    return new Response(JSON.stringify({
      error: "Campos obrigatórios ausentes",
      faltando: { venda_id: !venda_id, aluno_id: !aluno_id, card_number: !card_number, card_holder: !card_holder, security_code: !security_code, expiration_month: !expiration_month, expiration_year: !expiration_year },
    }), { status: 400, headers });
  }

  if (!luhn(card_number)) {
    return new Response(JSON.stringify({ error: "Número de cartão inválido (falhou no Luhn)" }), { status: 400, headers });
  }



  // Idempotência
  const { data: existing } = await supabase
    .from("pagamentos_rede")
    .select("tid, status")
    .eq("venda_id", venda_id)
    .in("status", ["approved", "pending"])
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({
      success: true, idempotente: true, tid: existing.tid, status: existing.status,
    }), { status: 200, headers });
  }

  // Carregar credenciais
  const secrets = await loadSecrets(supabase, { verbose: true });
  const pv    = secrets["rede_pv"];
  const token = secrets["rede_token"];
  const baseUrl = resolveRedeBaseUrl(secrets["rede_ambiente"]);

  if (!pv || !token) {
    return new Response(JSON.stringify({
      error: "Credenciais Rede não configuradas",
      ajuda: "Adicione REDE_PV, REDE_TOKEN e REDE_AMBIENTE nos Secrets de Edge Functions no painel do Supabase (Settings → Edge Functions → Secrets)",
    }), { status: 500, headers });
  }

  // Valor da venda
  const { data: venda } = await supabase.from("vendas")
    .select("valor_final, valor, desconto, tipo_cobranca, taxa_mensal, catalogo_id, data_venda")
    .eq("id", venda_id).single();
  // Para Recorrência cobramos APENAS a 1ª mensalidade agora (valor mensal + taxa)
  const isRecorrencia = isVendaRecorrencia(venda as any);
  let periodoMeses = 1;
  if (isRecorrencia) {
    // Buscar período do plano para calcular valor mensal
    const { data: plano } = await supabase.from("planos_catalogo")
      .select("periodo_meses").eq("id", (venda as any)?.catalogo_id).maybeSingle();
    periodoMeses = normalizarPeriodoMeses((plano as any)?.periodo_meses);
  }
  const amount = calcularAmountCentavos(venda as any, periodoMeses);
  if (amount <= 0) {
    return new Response(JSON.stringify({ error: "Valor da venda inválido ou zerado" }), { status: 400, headers });
  }

  const cardClean = card_number.replace(/\D/g, "");

  const captureFinal = typeof capture_override === "boolean" ? capture_override : true;
  const payload: Record<string, unknown> = {
    capture:          captureFinal,
    kind:             "credit",
    reference:        buildReference(venda_id),
    amount,
    installments:     Number(installments),
    cardholderName:   normalizeCardholderName(card_holder),
    cardNumber:       cardClean,
    expirationMonth:  formatExpirationMonth(expiration_month),
    expirationYear:   formatExpirationYear(expiration_year),
    securityCode:     String(security_code),
  };


  if (save_card) {
    payload.storageCard = 1; // integer, não objeto (1=CIT primeira tx, 2=MIT subsequente)
  }

  console.log("[rede] chamando", baseUrl, "amount:", amount, "installments:", installments);
  console.log("[rede] payload enviado:", JSON.stringify({
    ...payload,
    cardNumber:   payload.cardNumber ? "****" + String(payload.cardNumber).slice(-4) : undefined,
    securityCode: payload.securityCode ? "***" : undefined,
  }, null, 2));
  console.log("[rede] URL final:", `${baseUrl}/transactions`);
  console.log("[rede] reference enviado:", payload.reference);

  console.log("[rede] amount:", amount, "installments:", installments);
  console.log("[rede] expirationMonth:", payload.expirationMonth, "type:", typeof payload.expirationMonth);
  console.log("[rede] expirationYear:", payload.expirationYear, "type:", typeof payload.expirationYear);
  console.log("[rede] cardholderName:", payload.cardholderName, "type:", typeof payload.cardholderName);
  console.log("[rede] kind:", payload.kind, "capture:", payload.capture);

  let redeResponse: any = null;
  let redeStatus = 0;
  try {
    let authHeaderRede: string;
    if (auth_mode === "basic") {
      authHeaderRede = "Basic " + btoa(`${pv.trim()}:${token.trim()}`);
      console.log("[rede] auth_mode: BASIC (PV:Token)");
    } else {
      authHeaderRede = "Bearer " + (await getRedeAccessToken(pv, token, secrets["rede_ambiente"] ?? "sandbox"));
      console.log("[rede] auth_mode: BEARER (OAuth)");
    }
    console.log("[rede] capture final:", captureFinal);
    const resp = await fetch(`${baseUrl}/transactions`, {
      method:  "POST",
      headers: {
        "Authorization":  authHeaderRede,
        "Content-Type":   "application/json",
      },
      body: JSON.stringify(payload),
    });
    redeStatus = resp.status;

    const text = await resp.text();
    console.log("[rede] HTTP status:", redeStatus);
    console.log("[rede] response body bruto:", text.slice(0, 1000));
    try { redeResponse = JSON.parse(text); } catch { redeResponse = { rawText: text }; }
    console.log("[rede] response parseado:", JSON.stringify(redeResponse));

  } catch (e) {
    console.error("[rede] fetch error:", String(e));
    return new Response(JSON.stringify({ error: "Erro de comunicação com a Rede", detalhe: String(e) }), { status: 502, headers });
  }

  const { returnCode, approved, status } = mapReturnCode(redeResponse?.returnCode);

  // Persistir auditoria (trigger no banco sanitiza o raw_response)
  const { error: insertErr } = await supabase.from("pagamentos_rede").insert({
    venda_id,
    created_by:         user.id,
    tid:                redeResponse?.tid,
    nsu:                redeResponse?.nsu,
    authorization_code: redeResponse?.authorizationCode,
    return_code:        returnCode,
    return_message:     redeResponse?.returnMessage,
    amount,
    installments:       Number(installments),
    kind:               "credit",
    status,
    raw_response:       redeResponse,
  });
  if (insertErr) console.error("[rede] insert pagamentos_rede:", insertErr.message);

  // Atualizar venda
  await supabase.from("vendas")
    .update({ status_pagamento: approved ? "pago" : "falha" })
    .eq("id", venda_id);

  // Atualizar parcelas se aprovado
  if (approved) {
    const { data: pagamento } = await supabase
      .from("pagamentos").select("id").eq("venda_id", venda_id).maybeSingle();
    if (pagamento) {
      await supabase.from("pagamento_parcelas")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("pagamento_id", pagamento.id)
        .eq("status", "pendente");
    }
  }

  // Salvar token se solicitado e aprovado
  if (approved && save_card) {
    // A Rede pode retornar o token em diferentes campos dependendo da versão
    const cardToken = redeResponse?.cardToken
      ?? redeResponse?.cardStorage?.cardId
      ?? redeResponse?.storageCard?.cardId
      ?? redeResponse?.tokenId
      ?? null;

    console.log("[rede] campos de token na resposta:", {
      cardToken:    redeResponse?.cardToken,
      cardStorage:  redeResponse?.cardStorage,
      storageCard:  redeResponse?.storageCard,
      tokenId:      redeResponse?.tokenId,
      allKeys:      Object.keys(redeResponse ?? {}),
    });

    let savedCartaoId: string | null = null;
    if (cardToken) {
      const { data: inserted } = await supabase.from("cartoes_salvos").insert({
        aluno_id,
        token_rede:        cardToken,
        brand:             redeResponse?.brand ?? redeResponse?.brandName ?? "unknown",
        last4:             cardClean.slice(-4),
        holder_name:       card_holder,
        expiration_month:  Number(expiration_month),
        expiration_year:   Number(expiration_year),
        is_default:        true,
        origem,
      }).select("id").single();
      savedCartaoId = (inserted as any)?.id ?? null;
      console.log("[rede] cartão salvo com token:", cardToken.slice(0, 8) + "...");
    } else {
      console.warn("[rede] cartão não salvo — token ausente na resposta. Chaves disponíveis:", Object.keys(redeResponse ?? {}));
    }

    // Recorrência: criar contrato + N cobranças (1ª paga), onde N = periodo_meses do plano
    if (isRecorrencia) {
      const periodoQ = await supabase.from("planos_catalogo")
        .select("periodo_meses").eq("id", (venda as any)?.catalogo_id).maybeSingle();
      const periodo = Math.max(1, Number((periodoQ.data as any)?.periodo_meses) || 1);
      const subtotal = Math.max(0, (Number((venda as any)?.valor) || 0) - (Number((venda as any)?.desconto) || 0));
      const valorMensal = subtotal / periodo;
      const { error: rpcErr } = await supabase.rpc("fn_criar_contrato_recorrencia", {
        p_venda_id: venda_id,
        p_aluno_id: aluno_id,
        p_plano_id: (venda as any)?.catalogo_id,
        p_valor_mensal: valorMensal,
        p_taxa_mensal: Number((venda as any)?.taxa_mensal) || 0,
        p_data_inicio: (venda as any)?.data_venda ?? new Date().toISOString().split("T")[0],
        p_forma_pagamento: "cartao_recorrencia",
        p_cartao_token_id: savedCartaoId,
        p_primeira_paga: true,
        p_servicos_inclusos: servicos_inclusos,
      });
      if (rpcErr) console.error("[rede] fn_criar_contrato_recorrencia:", rpcErr.message);

    } else {
      // Tradicional pago via cartão online: contrato + cobranças (todas pagas)
      const subtotal = Math.max(0, (Number((venda as any)?.valor) || 0) - (Number((venda as any)?.desconto) || 0));
      const { error: rpcTradErr } = await supabase.rpc("fn_criar_contrato_tradicional", {
        p_venda_id: venda_id,
        p_aluno_id: aluno_id,
        p_plano_id: (venda as any)?.catalogo_id,
        p_valor_total: subtotal,
        p_parcelas: Number((venda as any)?.parcelas) || 1,
        p_forma_pagamento: "cartao_credito",
        p_data_inicio: (venda as any)?.data_venda ?? new Date().toISOString().split("T")[0],
        p_status_pagamento: "pago",
        p_servicos_inclusos: servicos_inclusos,
      });
      if (rpcTradErr) console.error("[rede] fn_criar_contrato_tradicional:", rpcTradErr.message);
    }
  }

  return new Response(JSON.stringify({
    success:        approved,
    return_code:    returnCode,
    return_message: redeResponse?.returnMessage,
    tid:            redeResponse?.tid,
    rede_http_status: redeStatus,
  }), { status: 200, headers });
});
