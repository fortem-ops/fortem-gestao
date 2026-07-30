import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

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
    storageCard: 1,
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

  // Cancelar imediatamente (pré-auth de R$0,01)
  if (tid) {
    try {
      await fetch(`${baseUrl}/transactions/${tid}`, {
        method: "DELETE",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.warn("[rede-salvar-cartao] cancelamento falhou (não crítico):", String(e));
    }
  }

  // Extrair token do cartão
  const cardToken = redeResp?.cardToken
    ?? redeResp?.cardStorage?.cardId
    ?? redeResp?.storageCard?.cardId
    ?? redeResp?.tokenId
    ?? null;

  if (!cardToken) {
    console.error("[rede-salvar-cartao] tokenização falhou. Chaves:", Object.keys(redeResp ?? {}));
    return new Response(JSON.stringify({
      success: false,
      error: "Cartão aprovado, mas não foi possível gerar token seguro. Tente novamente.",
    }), { status: 500, headers });
  }

  const brand = redeResp?.brand ?? redeResp?.brandName ?? detectBrand(cardClean);
  const last4 = cardClean.slice(-4);

  const { error: insErr } = await supabase.from("cartoes_salvos").insert({
    aluno_id,
    token_rede: cardToken,
    brand,
    last4,
    holder_name: String(card_holder).trim().toUpperCase(),
    expiration_month: Number(expiration_month),
    expiration_year: Number(String(expiration_year).length === 2 ? "20" + expiration_year : expiration_year),
    ativo: true,
    is_default: false,
    origem,
  });

  if (insErr) {
    console.error("[rede-salvar-cartao] insert erro:", insErr.message);
    return new Response(JSON.stringify({ success: false, error: "Falha ao salvar cartão" }), { status: 500, headers });
  }

  // Marcar link como usado
  if (origem === "link_cadastro" && linkRecord) {
    await supabase.from("links_cartao").update({ usado: true }).eq("id", linkRecord.id);
  }

  return new Response(JSON.stringify({ success: true, last4, brand }), { status: 200, headers });
});
