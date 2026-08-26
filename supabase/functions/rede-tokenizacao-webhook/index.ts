import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";

const TOKEN_SERVICE_URLS = {
  sandbox:  "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/tokenization",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/tokenization",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function loadSecrets(supabase: any): Promise<Record<string, string>> {
  const m: Record<string, string> = {};

  const envPv      = Deno.env.get("REDE_PV")       ?? "";
  const envToken   = Deno.env.get("REDE_TOKEN")    ?? "";
  const envAmbient = Deno.env.get("REDE_AMBIENTE") ?? "";

  if (envPv)      m["rede_pv"]       = envPv;
  if (envToken)   m["rede_token"]    = envToken;
  if (envAmbient) m["rede_ambiente"] = envAmbient;

  if (m["rede_pv"] && m["rede_token"]) {
    if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";
    return m;
  }

  try {
    const { data, error } = await supabase
      .schema("vault")
      .from("decrypted_secrets")
      .select("name, decrypted_secret")
      .in("name", ["rede_pv", "rede_token", "rede_ambiente"]);

    if (!error && data?.length > 0) {
      data.forEach((s: any) => { if (s.decrypted_secret) m[s.name] = s.decrypted_secret; });
    }
  } catch { /* ignore */ }

  if (!m["rede_ambiente"]) m["rede_ambiente"] = "sandbox";
  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), { status: 405, headers });
  }

  // 1. Autenticação do webhook
  const expected = Deno.env.get("REDE_WEBHOOK_TOKEN") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !provided || provided !== expected) {
    console.warn("[rede-tokenizacao-webhook] autenticação inválida");
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers });
  }

  // 2. Parse do payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400, headers });
  }

  const tokenizationId = body?.data?.tokenizationId ?? body?.tokenizationId ?? null;
  console.log("[rede-tokenizacao-webhook] evento recebido:", JSON.stringify({
    id: body?.id ?? null,
    merchant_id: body?.merchant_id ?? null,
    events: body?.events ?? null,
    tokenizationId,
  }));

  if (!tokenizationId) {
    return new Response(JSON.stringify({ error: "tokenizationId ausente" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3/4/5/6. Processamento (síncrono, mas rápido) — respondemos 200 ao final
  try {
    const secrets = await loadSecrets(supabase);
    const ambiente = secrets["rede_ambiente"] === "producao" ? "producao" : "sandbox";
    const baseUrl = TOKEN_SERVICE_URLS[ambiente];

    const accessToken = await getRedeAccessToken(
      String(secrets["rede_pv"] ?? "").trim(),
      String(secrets["rede_token"] ?? "").trim(),
      ambiente,
    );

    // Consulta o status da tokenização. A Rede às vezes responde
    // tokenizationStatus="Active" com brand.tokenStatus="Unavailable" e sem o
    // campo `token` populado — isso é "ainda processando", NÃO falha. Nesse caso
    // repetimos a mesma consulta algumas vezes antes de desistir.
    const consultarTokenizacao = async () => {
      const r = await fetch(`${baseUrl}/${tokenizationId}`, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      });
      const text = await r.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { rawText: text }; }
      return { httpStatus: r.status, parsed };
    };

    const MAX_TENTATIVAS = 3; // 1 inicial + 2 retries
    const RETRY_DELAY_MS = 3000;

    let consulta: any = null;
    let httpStatus = 0;
    let statusRede = "";
    let brandTokenStatus = "";
    let tokenCode = "";
    let tentativas = 0;

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const res = await consultarTokenizacao();
      httpStatus = res.httpStatus;
      consulta = res.parsed;
      tentativas = i + 1;
      console.log(
        `[rede-tokenizacao-webhook] consulta (tentativa ${tentativas}/${MAX_TENTATIVAS}) status:`,
        httpStatus,
        "body:",
        JSON.stringify(consulta),
      );

      statusRede = String(consulta?.tokenizationStatus ?? "").trim();
      brandTokenStatus = String(consulta?.brand?.tokenStatus ?? "").trim();
      tokenCode = String(consulta?.token?.code ?? "").trim();

      // Recusa explícita da bandeira → falha definitiva, não adianta insistir.
      if (brandTokenStatus === "Failed") break;
      // Token já disponível ou estado terminal diferente de Active → segue.
      if (tokenCode.length > 0 || statusRede !== "Active") break;
      // Active + token vazio + brand != Failed → ainda processando, retry.
      if (i < MAX_TENTATIVAS - 1) {
        console.warn(
          `[rede-tokenizacao-webhook] tokenização ${tokenizationId} ainda sem token ` +
          `(brand.tokenStatus="${brandTokenStatus || "ausente"}"). Retentando em ${RETRY_DELAY_MS}ms.`,
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    const statusLower = statusRede.toLowerCase();

    // Falha mascarada = SOMENTE recusa explícita da bandeira.
    const falhaMascarada = statusRede === "Active" && brandTokenStatus === "Failed";

    // Active sem token e sem recusa explícita = ainda processando → "pending",
    // para que uma nova consulta possa acontecer depois.
    const aindaProcessando =
      statusRede === "Active" && !falhaMascarada && tokenCode.length === 0;

    if (aindaProcessando) {
      console.warn(
        `[rede-tokenizacao-webhook] tokenização ${tokenizationId} permanece sem token após ` +
        `${tentativas} tentativa(s). Gravando como "pending" (não falha).`,
      );
    }

    const update: Record<string, unknown> = {
      status: falhaMascarada
        ? "failed"
        : aindaProcessando
          ? "pending"
          : (statusLower || "pending"),
      brand_name: consulta?.brand?.name ?? null,
      brand_tid: consulta?.brand?.brandTid ?? null,
      bin: consulta?.bin ?? null,
      last4: consulta?.last4 ?? null,
      token_code: tokenCode || null,
      token_expiration: consulta?.token?.expirationDate ?? null,
      raw_response: consulta,
      updated_at: new Date().toISOString(),
    };


    const { data: registro, error: updErr } = await supabase
      .from("rede_tokenizacoes")
      .update(update)
      .eq("tokenization_id", tokenizationId)
      .select("id, aluno_id, origem, cartao_salvo_id, cardholder_name")
      .maybeSingle();

    if (updErr) {
      console.error("[rede-tokenizacao-webhook] erro ao atualizar registro:", updErr.message);
    }

    if (falhaMascarada && registro) {
      const motivo = consulta?.brand?.message
        ? `Bandeira recusou o token: ${consulta.brand.message}`
        : `Bandeira recusou o token (tokenStatus: ${brandTokenStatus || "ausente"})`;
      console.warn(
        `[rede-tokenizacao-webhook] tokenização ${tokenizationId} marcada como failed. ${motivo}`
      );
      try {
        await supabase.from("system_logs").insert({
          modulo: "rede-tokenizacao-webhook",
          acao: "tokenizacao_falhou_bandeira",
          mensagem: `Tokenização ${tokenizationId} falhou: ${motivo}`,
          payload: {
            tokenization_id: tokenizationId,
            aluno_id: registro?.aluno_id ?? null,
            origem: registro?.origem ?? null,
            return_code: consulta?.returnCode ?? null,
            brand_token_status: brandTokenStatus || null,
            brand_message: consulta?.brand?.message ?? null,
            raw_response: consulta,
          },
        });
      } catch (e) {
        console.error("[rede-tokenizacao-webhook] falha ao registrar system_logs:", String(e));
      }
    }

    if (statusRede === "Active" && !falhaMascarada && !aindaProcessando && tokenCode.length > 0 && registro && !registro.cartao_salvo_id) {
      // Parse da validade no formato MM/YYYY (ex: "08/2034")
      let expMonth = 0;
      let expYear = 0;
      const expRaw = String(consulta?.token?.expirationDate ?? "").trim();
      const expParts = expRaw ? expRaw.split("/") : [];
      if (expParts.length === 2) {
        expMonth = parseInt(expParts[0], 10);
        expYear = parseInt(expParts[1], 10);
      }
      const validParse = expMonth >= 1 && expMonth <= 12 && expYear >= 2024;
      if (!validParse) {
        const now = new Date();
        expMonth = now.getMonth() + 1;
        expYear = now.getFullYear() + 5;
        console.warn(
          `[rede-tokenizacao-webhook] validade do token não pôde ser parseada (recebido: "${expRaw}"). ` +
          `Usando fallback ${String(expMonth).padStart(2, "0")}/${expYear}. Isso pode indicar um problema de mapeamento a ser revisado.`
        );
      }

      const resultadoCartao = await salvarCartaoComSubstituicao(supabase, {
        alunoId: registro.aluno_id,
        last4: String(consulta?.last4 ?? "").trim(),
        tokenRede: consulta?.token?.code ?? null,
        brand: consulta?.brand?.name ?? null,
        expirationMonth: expMonth,
        expirationYear: expYear,
        holderName: registro?.cardholder_name ?? "TITULAR",
        origem: registro.origem ?? "tokenizacao_bandeira",
      });
      const cartao = resultadoCartao.cartaoId ? { id: resultadoCartao.cartaoId } : null;

      if (resultadoCartao.erro) {
        console.error("[rede-tokenizacao-webhook] erro ao inserir cartão:", resultadoCartao.erro);
      } else if (cartao?.id) {
        if (resultadoCartao.substituiuId) {
          console.log(
            `[rede-tokenizacao-webhook] cartão anterior ${resultadoCartao.substituiuId} substituído por ${cartao.id} — ` +
            `${resultadoCartao.contratosRepontados} contrato(s), ${resultadoCartao.planosRepontados} plano(s) repontados`,
          );
        }
        await supabase
          .from("rede_tokenizacoes")
          .update({ cartao_salvo_id: cartao.id, updated_at: new Date().toISOString() })
          .eq("id", registro.id);
        console.log("[rede-tokenizacao-webhook] cartão salvo:", cartao.id);

        // Fase 2: vincula o cartão recém-criado a TODOS os contratos ativos de
        // recorrência do aluno que ainda estiverem sem cartão vinculado.
        const { data: contratosVinculados, error: vincErr } = await supabase
          .from("contratos")
          .update({ cartao_token_id: cartao.id, updated_at: new Date().toISOString() })
          .eq("aluno_id", registro.aluno_id)
          .eq("status", "ativo")
          .eq("forma_pagamento", "cartao_recorrencia")
          .is("cartao_token_id", null)
          .select("id");

        const idsContratos = Array.isArray(contratosVinculados)
          ? contratosVinculados.map((c: any) => c.id)
          : [];
        try {
          await supabase.from("system_logs").insert({
            modulo: "rede-tokenizacao-webhook",
            acao: "cartao_vinculado_contratos",
            mensagem: `Cartão ${cartao.id} vinculado a ${idsContratos.length} contrato(s) ativo(s) de recorrência do aluno ${registro.aluno_id}`,
            payload: {
              cartao_salvo_id: cartao.id,
              aluno_id: registro.aluno_id,
              tokenization_id: tokenizationId,
              contratos_vinculados: idsContratos.length,
              contrato_ids: idsContratos,
              erro: vincErr?.message ?? null,
            },
          });
        } catch (e) {
          console.error("[rede-tokenizacao-webhook] falha ao registrar system_logs:", String(e));
        }
        if (vincErr) {
          console.error("[rede-tokenizacao-webhook] erro ao vincular cartão a contratos:", vincErr.message);
        }
      }
    }

    if (statusRede === "Failed") {
      try {
        await supabase.from("system_logs").insert({
          modulo: "rede-tokenizacao-webhook",
          acao: "tokenizacao_falhou",
          mensagem: consulta?.brand?.message ?? "Tokenização de bandeira falhou",
          payload: {
            tokenization_id: tokenizationId,
            aluno_id: registro?.aluno_id ?? null,
            origem: registro?.origem ?? null,
            tokenization_status: statusRede,
            brand: consulta?.brand ?? null,
            bin: consulta?.bin ?? null,
            last4: consulta?.last4 ?? null,
            raw_response: consulta,
          },
        });
      } catch (e) {
        console.error("[rede-tokenizacao-webhook] falha ao registrar system_logs:", String(e));
      }
    }

    return new Response(JSON.stringify({ received: true, status: statusLower || "pending" }), { status: 200, headers });
  } catch (e) {
    console.error("[rede-tokenizacao-webhook] erro no processamento:", String(e));
    // Ainda respondemos 200 para evitar retentativas em loop da Rede
    return new Response(JSON.stringify({ received: true, processed: false }), { status: 200, headers });
  }
});
