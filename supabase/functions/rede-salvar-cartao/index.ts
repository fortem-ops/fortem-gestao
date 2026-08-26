import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { salvarCartaoComSubstituicao, respostaSalvarCartaoSucesso } from "../_shared/cartao-substituicao.ts";

const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function luhn(n: string): boolean {
  const d = n.replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let digit = parseInt(d[i]);
    if (odd) { digit *= 2; if (digit > 9) digit -= 9; }
    s += digit; odd = !odd;
  }
  return s % 10 === 0;
}

function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5067|6277|6362|6363|4011|4312|4389|4514)/.test(n)) return "elo";
  if (/^606282/.test(n)) return "hipercard";
  if (/^(34|37)/.test(n)) return "amex";
  if (/^(36|38)/.test(n)) return "diners";
  if (/^5[1-5]/.test(n)) return "master";
  const bin4 = parseInt(n.slice(0, 4));
  if (bin4 >= 2221 && bin4 <= 2720) return "master";
  return "desconhecida";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), { status: 405, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Body JSON inválido" }), { status: 400, headers });
  }

  const {
    aluno_id,
    card_number,
    card_holder,
    expiration_month,
    expiration_year,
    security_code,
    origem = "link_cadastro",
    token,
    link_token,
  } = body ?? {};

  const linkToken = link_token ?? token ?? null;
  let alunoId = aluno_id ?? null;

  // Validar link público (quando enviado)
  let linkRecord: any = null;
  if (linkToken) {
    let q = supabase
      .from("links_cartao")
      .select("id, aluno_id, usado, expira_em")
      .eq("token", linkToken);
    if (alunoId) q = q.eq("aluno_id", alunoId);
    const { data: link } = await q.maybeSingle();

    if (!link) {
      return new Response(JSON.stringify({ success: false, error: "Link inválido ou não encontrado" }), { status: 404, headers });
    }
    if (link.usado) {
      return new Response(JSON.stringify({ success: false, error: "Este link já foi utilizado" }), { status: 410, headers });
    }
    if (new Date(link.expira_em).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "Link expirado. Solicite um novo link na recepção" }), { status: 410, headers });
    }
    linkRecord = link;
    alunoId = link.aluno_id;
  }

  if (!alunoId || !card_number || !card_holder || !expiration_month || !expiration_year || !security_code) {
    return new Response(JSON.stringify({
      success: false,
      error: "Campos obrigatórios ausentes",
    }), { status: 400, headers });
  }

  const cardClean = String(card_number).replace(/\D/g, "");
  if (!luhn(cardClean)) {
    return new Response(JSON.stringify({ success: false, error: "Número de cartão inválido" }), { status: 400, headers });
  }


  // Credenciais Rede
  const pv = Deno.env.get("REDE_PV") ?? "";
  const tokenSecret = Deno.env.get("REDE_TOKEN") ?? "";
  const ambiente = Deno.env.get("REDE_AMBIENTE") ?? "sandbox";
  const baseUrl = REDE_URLS[ambiente as "sandbox" | "producao"] ?? REDE_URLS.sandbox;

  if (!pv || !tokenSecret) {
    return new Response(JSON.stringify({
      success: false,
      error: "Credenciais Rede não configuradas",
    }), { status: 500, headers });
  }

  // OAuth
  let accessToken: string;
  try {
    accessToken = await getRedeAccessToken(pv.trim(), tokenSecret.trim(), ambiente);
  } catch (e) {
    console.error("[rede-salvar-cartao] oauth erro:", String(e));
    return new Response(JSON.stringify({ success: false, error: "Falha na autenticação Rede" }), { status: 502, headers });
  }

  // ============================================================
  // NOVO FLUXO PRINCIPAL: Tokenização de Bandeira (assíncrono)
  // A Rede processa e nos avisa via webhook rede-tokenizacao-webhook.
  // ============================================================
  {
    const tokenizacaoUrl = ambiente === "producao"
      ? "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization"
      : "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization";

    // Email do aluno (preferencial) com fallback fixo
    let email = "cobranca@fortem.app";
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("email")
        .eq("id", alunoId)
        .maybeSingle();
      if (aluno?.email && String(aluno.email).includes("@")) email = String(aluno.email).trim();
    } catch { /* usa fallback */ }

    const tokenPayload: Record<string, unknown> = {
      email,
      cardNumber: cardClean,
      expirationMonth: String(expiration_month).padStart(2, "0"),
      expirationYear: (() => { const y = String(expiration_year).trim(); return y.length === 2 ? "20" + y : y; })(),
      cardholderName: String(card_holder).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      storageCard: "2",
      embeddedZeroDollar: true,
    };
    if (security_code) tokenPayload.securityCode = String(security_code);

    let tokResp: any = null;
    let tokHttpStatus = 0;
    try {
      const r = await fetch(tokenizacaoUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tokenPayload),
      });
      tokHttpStatus = r.status;
      const text = await r.text();
      try { tokResp = JSON.parse(text); } catch { tokResp = { rawText: text }; }
      console.log("[rede-salvar-cartao] tokenização status:", tokHttpStatus, "resposta:", JSON.stringify(tokResp));
    } catch (e) {
      console.error("[rede-salvar-cartao] tokenização fetch erro:", String(e));
      try {
        await supabase.from("system_logs").insert({
          modulo: "rede-salvar-cartao",
          acao: "tokenizacao_falhou",
          mensagem: "Erro de comunicação com a Rede ao solicitar tokenização de bandeira",
          payload: { aluno_id: alunoId, origem, last4: cardClean.slice(-4), erro: String(e) },
        });
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ success: false, error: "Erro de comunicação com a Rede" }), { status: 502, headers });
    }

    const tokenizationId = tokResp?.tokenizationId ?? tokResp?.data?.tokenizationId ?? null;
    const httpOk = tokHttpStatus >= 200 && tokHttpStatus < 300;
    const returnCode = tokResp?.returnCode ?? null;
    const returnCodeOk = returnCode == null || returnCode === "00";

    if (!httpOk || !tokenizationId || !returnCodeOk) {
      console.error("[rede-salvar-cartao] solicitação de tokenização falhou:", tokHttpStatus, JSON.stringify(tokResp));
      try {
        await supabase.from("system_logs").insert({
          modulo: "rede-salvar-cartao",
          acao: "tokenizacao_falhou",
          mensagem: `Solicitação de tokenização de bandeira rejeitada (HTTP ${tokHttpStatus})`,
          payload: {
            status: "solicitacao_tokenizacao_falhou",
            aluno_id: alunoId,
            origem,
            http_status: tokHttpStatus,
            return_code: returnCode,
            return_message: tokResp?.returnMessage ?? tokResp?.message ?? null,
            last4: cardClean.slice(-4),
            raw_response: tokResp,
          },
        });
      } catch (e) {
        console.error("[rede-salvar-cartao] falha ao registrar auditoria em system_logs:", String(e));
      }
      return new Response(JSON.stringify({
        success: false,
        error: tokResp?.returnMessage ?? tokResp?.message ?? "Não foi possível iniciar a validação do cartão",
        return_code: returnCode,
      }), { status: 400, headers });
    }

    const { error: tokInsErr } = await supabase.from("rede_tokenizacoes").insert({
      tokenization_id: String(tokenizationId),
      aluno_id: alunoId,
      origem,
      cardholder_name: tokenPayload.cardholderName,
      status: "pending",
      raw_response: tokResp,
    });
    if (tokInsErr) {
      console.error("[rede-salvar-cartao] erro ao inserir rede_tokenizacoes:", tokInsErr.message);
    }

    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-salvar-cartao",
        acao: "tokenizacao_solicitada",
        mensagem: `Tokenização de bandeira solicitada (tokenizationId ${tokenizationId})`,
        payload: {
          status: "pending",
          aluno_id: alunoId,
          origem,
          tokenization_id: tokenizationId,
          last4: cardClean.slice(-4),
          raw_response: tokResp,
        },
      });
    } catch (e) {
      console.error("[rede-salvar-cartao] falha ao registrar auditoria de solicitação:", String(e));
    }

    // Marcar link como usado
    if (linkRecord) {
      await supabase.from("links_cartao")
        .update({ usado: true, usado_em: new Date().toISOString() })
        .eq("id", linkRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      status: "pending",
      tokenization_id: String(tokenizationId),
      message: "Cartão em validação, você será notificado em instantes.",
    }), { status: 200, headers });
  }

  // ============================================================
  // FLUXO ANTIGO (Zero Dollar direto + storageCard=1 / brandTid)
  // Mantido temporariamente para referência — inalcançável.
  // ============================================================
  // Pré-autorização de R$ 0,01

  const reference = ("save" + Date.now().toString()).slice(0, 20);
  const payload: Record<string, unknown> = {
    capture: false,
    kind: "credit",
    reference,
    amount: 1,
    installments: 1,
    cardholderName: String(card_holder).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    cardNumber: cardClean,
    expirationMonth: String(expiration_month).padStart(2, "0"),
    expirationYear: (() => { const y = String(expiration_year).trim(); return y.length === 2 ? "20" + y : y; })(),
    securityCode: String(security_code),
    storageCard: "1",
  };

  let redeResp: any = null;
  let redeStatus = 0;
  try {
    const r = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    redeStatus = r.status;
    const text = await r.text();
    try { redeResp = JSON.parse(text); } catch { redeResp = { rawText: text }; }
    console.log("[rede-salvar-cartao] status:", redeStatus, "returnCode:", redeResp?.returnCode);
    // Corpo completo da resposta (sem PAN/CVV — a Rede não os retorna), sempre logado
    console.log("[rede-salvar-cartao] resposta Rede (completa):", JSON.stringify(redeResp));
  } catch (e) {
    console.error("[rede-salvar-cartao] fetch erro:", String(e));
    return new Response(JSON.stringify({ success: false, error: "Erro de comunicação com a Rede" }), { status: 502, headers });
  }

  if (redeResp?.returnCode !== "00") {
    return new Response(JSON.stringify({
      success: false,
      error: redeResp?.returnMessage ?? "Cartão não aprovado",
      return_code: redeResp?.returnCode,
    }), { status: 400, headers });
  }

  const tid = redeResp?.tid;
  console.log("[rede-salvar-cartao] tid da pré-autorização:", tid ?? "(ausente)", "nsu:", redeResp?.nsu ?? "-", "auth:", redeResp?.authorizationCode ?? "-");

  // Cancelar imediatamente (pré-auth de R$0,01)
  let cancelStatus: number | null = null;
  let cancelBody: string | null = null;
  if (tid) {
    try {
      const c = await fetch(`${baseUrl}/transactions/${tid}`, {
        method: "DELETE",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      });
      cancelStatus = c.status;
      cancelBody = (await c.text()).slice(0, 1000);
      if (c.ok) {
        console.log("[rede-salvar-cartao] cancelamento tid", tid, "status:", cancelStatus, "body:", cancelBody);
      } else {
        console.error("[rede-salvar-cartao] cancelamento NÃO confirmado — tid", tid, "status:", cancelStatus, "body:", cancelBody);
      }
    } catch (e) {
      cancelBody = String(e);
      console.warn("[rede-salvar-cartao] cancelamento falhou (não crítico):", String(e));
    }
  } else {
    console.error("[rede-salvar-cartao] transação aprovada SEM tid — estorno impossível de rastrear");
  }

  // Extrair token do cartão
  // Pela documentação e-Rede (fluxo storageCard=1), o identificador a ser
  // reutilizado nas cobranças futuras é o campo `brandTid`. Mantemos os demais
  // campos como fallback defensivo caso a Rede mude o formato da resposta.
  const cardToken = redeResp?.brandTid
    ?? redeResp?.cardToken
    ?? redeResp?.cardStorage?.cardId
    ?? redeResp?.storageCard?.cardId
    ?? redeResp?.tokenId
    ?? null;

  if (!cardToken) {
    console.error("[rede-salvar-cartao] tokenização falhou. tid:", tid ?? "(ausente)", "chaves:", Object.keys(redeResp ?? {}));
    // Trilha de auditoria: pagamentos_rede exige venda_id (NOT NULL/FK), que não existe
    // neste fluxo — registramos em system_logs para permitir rastrear/estornar depois.
    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-salvar-cartao",
        acao: "tokenizacao_falhou",
        mensagem: `Pré-autorização de R$0,01 aprovada (tid ${tid ?? "ausente"}), mas a Rede não retornou brandTid/token de cartão`,
        payload: {
          status: "tokenizacao_falhou",
          motivo: "resposta da Rede sem brandTid/cardToken/cardStorage/storageCard/tokenId",
          aluno_id: alunoId,
          origem,
          tid: tid ?? null,
          nsu: redeResp?.nsu ?? null,
          authorization_code: redeResp?.authorizationCode ?? null,
          return_code: redeResp?.returnCode ?? null,
          return_message: redeResp?.returnMessage ?? null,
          amount: 1,
          last4: cardClean.slice(-4),
          cancelamento_http_status: cancelStatus,
          cancelamento_body: cancelBody,
          raw_response: redeResp,
        },
      });
    } catch (e) {
      console.error("[rede-salvar-cartao] falha ao registrar auditoria em system_logs:", String(e));
    }
    return new Response(JSON.stringify({
      success: false,
      error: "Cartão aprovado, mas não foi possível gerar token seguro. Tente novamente.",
    }), { status: 500, headers });
  }

  const brand = redeResp?.brand ?? redeResp?.brandName ?? detectBrand(cardClean);
  const last4 = cardClean.slice(-4);

  // Auditoria persistente da resposta completa da Rede em caso de sucesso
  try {
    await supabase.from("system_logs").insert({
      modulo: "rede-salvar-cartao",
      acao: "tokenizacao_sucesso",
      mensagem: `Cartão tokenizado com sucesso, tid ${tid ?? "ausente"}`,
      payload: {
        status: "tokenizacao_sucesso",
        aluno_id: alunoId,
        origem,
        tid: tid ?? null,
        nsu: redeResp?.nsu ?? null,
        authorization_code: redeResp?.authorizationCode ?? null,
        return_code: redeResp?.returnCode ?? null,
        return_message: redeResp?.returnMessage ?? null,
        amount: 1,
        last4,
        card_token: cardToken,
        raw_response: redeResp,
      },
    });
  } catch (e) {
    console.error("[rede-salvar-cartao] falha ao registrar auditoria de sucesso em system_logs:", String(e));
  }

  const resultadoCartao = await salvarCartaoComSubstituicao(supabase, {
    alunoId,
    last4,
    tokenRede: cardToken,
    brand,
    expirationMonth: Number(expiration_month),
    expirationYear: Number(String(expiration_year).length === 2 ? "20" + expiration_year : expiration_year),
    holderName: String(card_holder).trim().toUpperCase(),
    origem,
  });

  if (resultadoCartao.erro || !resultadoCartao.cartaoId) {
    console.error("[rede-salvar-cartao] insert erro:", resultadoCartao.erro);
    return new Response(JSON.stringify({ success: false, error: "Falha ao salvar cartão" }), { status: 500, headers });
  }

  // Marcar link como usado
  if (linkRecord) {
    await supabase.from("links_cartao")
      .update({ usado: true, usado_em: new Date().toISOString() })
      .eq("id", linkRecord.id);
  }


  return new Response(
    JSON.stringify(respostaSalvarCartaoSucesso(last4, brand, resultadoCartao.substituiuId)),
    { status: 200, headers },
  );
});
