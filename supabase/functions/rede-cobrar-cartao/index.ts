import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// URLs oficiais e-Rede (manual v1.13, seção Endpoints)
const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v1",
  producao: "https://api.userede.com.br/erede/v1",
};

const MAX_TENTATIVAS = 5;

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

function basicAuth(pv: string, token: string) {
  return "Basic " + btoa(`${pv}:${token}`);
}

async function loadSecrets(supabase: any): Promise<Record<string, string>> {
  const m: Record<string, string> = {};

  // 1. Tentar variáveis de ambiente primeiro (Edge Function Secrets — mais confiável)
  const envPv      = Deno.env.get("REDE_PV")       ?? "";
  const envToken   = Deno.env.get("REDE_TOKEN")    ?? "";
  const envAmbient = Deno.env.get("REDE_AMBIENTE") ?? "";

  if (envPv)      m["rede_pv"]       = envPv;
  if (envToken)   m["rede_token"]    = envToken;
  if (envAmbient) m["rede_ambiente"] = envAmbient;

  if (m["rede_pv"] && m["rede_token"]) {
    console.log("[rede] credenciais via env vars OK — ambiente:", m["rede_ambiente"] || "sandbox (default)");
    if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";
    return m;
  }

  // 2. Fallback: Supabase Vault
  try {
    const { data, error } = await supabase
      .schema("vault")
      .from("decrypted_secrets")
      .select("name, decrypted_secret")
      .in("name", ["rede_pv", "rede_token", "rede_ambiente"]);

    if (!error && data?.length > 0) {
      data.forEach((s: any) => { if (s.decrypted_secret) m[s.name] = s.decrypted_secret; });
      console.log("[rede] credenciais via Vault:", Object.keys(m).join(", "));
    } else {
      console.warn("[rede] Vault indisponível:", error?.message ?? "sem dados");
    }
  } catch (e) {
    console.warn("[rede] Vault exception:", String(e));
  }

  if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";

  console.log("[rede] status final credenciais:", {
    pv_ok:    (m["rede_pv"] ?? "").length > 0,
    token_ok: (m["rede_token"] ?? "").length > 0,
    ambiente: m["rede_ambiente"],
  });

  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // ── ENDPOINT DE DIAGNÓSTICO (GET /rede-cobrar-cartao/ping) ──
  if (req.method === "GET") {
    const supabaseDiag = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const secrets = await loadSecrets(supabaseDiag);
    const pv    = secrets["rede_pv"]    ?? "";
    const token = secrets["rede_token"] ?? "";

    let redeTestStatus = 0;
    let redeTestBody   = "";
    try {
      const baseUrl = "https://sandbox-erede.useredecloud.com.br/v1";
      const authHeader = "Basic " + btoa(`${pv.trim()}:${token.trim()}`);
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
      ambiente:         secrets["rede_ambiente"],
      rede_url:         "https://sandbox-erede.useredecloud.com.br/v1",
      rede_test_http:   redeTestStatus,
      rede_test_body:   redeTestBody,
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
  const secrets = await loadSecrets(supabase);
  const pv    = secrets["rede_pv"];
  const token = secrets["rede_token"];
  const baseUrl = REDE_URLS[secrets["rede_ambiente"] as "sandbox" | "producao"] ?? REDE_URLS.sandbox;

  if (!pv || !token) {
    return new Response(JSON.stringify({
      error: "Credenciais Rede não configuradas",
      ajuda: "Adicione REDE_PV, REDE_TOKEN e REDE_AMBIENTE nos Secrets de Edge Functions no painel do Supabase (Settings → Edge Functions → Secrets)",
    }), { status: 500, headers });
  }

  // Valor da venda
  const { data: venda } = await supabase.from("vendas").select("valor_final").eq("id", venda_id).single();
  const amount = Math.round((Number(venda?.valor_final) || 0) * 100);
  if (amount <= 0) {
    return new Response(JSON.stringify({ error: "Valor da venda inválido ou zerado" }), { status: 400, headers });
  }

  const cardClean = card_number.replace(/\D/g, "");

  const payload: Record<string, unknown> = {
    capture:          true,
    kind:             "credit",
    reference:        venda_id,
    amount,
    installments:     Number(installments),
    cardholderName:   card_holder,
    cardNumber:       cardClean,
    expirationMonth:  String(expiration_month).padStart(2, "0"),
    expirationYear:   String(expiration_year),
    securityCode:     String(security_code),
  };
  if (save_card) {
    payload.storageCard = 1; // integer, não objeto (1=CIT primeira tx, 2=MIT subsequente)
  }

  console.log("[rede] chamando", baseUrl, "amount:", amount, "installments:", installments);

  let redeResponse: any = null;
  let redeStatus = 0;
  try {
    const resp = await fetch(`${baseUrl}/transactions`, {
      method:  "POST",
      headers: {
        "Authorization":  basicAuth(pv, token),
        "Content-Type":   "application/json",
      },
      body: JSON.stringify(payload),
    });
    redeStatus = resp.status;
    const text = await resp.text();
    console.log("[rede] HTTP status:", redeStatus, "body:", text.slice(0, 300));
    try { redeResponse = JSON.parse(text); } catch { redeResponse = { rawText: text }; }
  } catch (e) {
    console.error("[rede] fetch error:", String(e));
    return new Response(JSON.stringify({ error: "Erro de comunicação com a Rede", detalhe: String(e) }), { status: 502, headers });
  }

  const returnCode = redeResponse?.returnCode ?? "XX";
  const approved   = returnCode === "00";
  const status     = approved ? "approved" : "denied";

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

    if (cardToken) {
      await supabase.from("cartoes_salvos").insert({
        aluno_id,
        token_rede:        cardToken,
        brand:             redeResponse?.brand ?? redeResponse?.brandName ?? "unknown",
        last4:             cardClean.slice(-4),
        holder_name:       card_holder,
        expiration_month:  Number(expiration_month),
        expiration_year:   Number(expiration_year),
        is_default:        true,
        origem,
      });
      console.log("[rede] cartão salvo com token:", cardToken.slice(0, 8) + "...");
    } else {
      console.warn("[rede] cartão não salvo — token ausente na resposta. Chaves disponíveis:", Object.keys(redeResponse ?? {}));
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
