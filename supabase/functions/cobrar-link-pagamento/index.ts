// Cobrança de cartão para vendas genéricas (não-Corrida) a partir de um link
// público de pagamento. Protegida pelo token do link (não exige login).
// Não executa nenhuma lógica específica da Corrida: apenas cobra a venda com o
// cartão recém-tokenizado (via rede-cobrar-token) e encerra o link se aprovado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "cobrar-link-pagamento", 10, 60);
    if (!ok) return json(429, { success: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const cartaoSalvoId = String(body?.cartao_salvo_id ?? "").trim();
    if (!token || token.length > 128) return json(400, { success: false, error: "token_invalido" });
    if (!UUID_RE.test(cartaoSalvoId)) return json(400, { success: false, error: "cartao_invalido" });

    const { data: link } = await admin
      .from("links_pagamento")
      .select("id, venda_id, expira_em")
      .eq("token", token)
      .maybeSingle();

    if (!link) return json(404, { success: false, error: "token_invalido" });
    if (new Date(link.expira_em).getTime() < Date.now()) {
      return json(410, { success: false, error: "token_expirado" });
    }

    const { data: venda } = await admin
      .from("vendas")
      .select("id, aluno_id, plano_id, valor_final, parcelas, status_pagamento")
      .eq("id", link.venda_id)
      .maybeSingle();

    if (!venda) return json(404, { success: false, error: "venda_nao_encontrada" });
    if (venda.status_pagamento === "pago") return json(200, { success: true, ja_pago: true });

    // o cartão precisa pertencer ao aluno da venda
    const { data: cartao } = await admin
      .from("cartoes_salvos")
      .select("id, aluno_id, ativo")
      .eq("id", cartaoSalvoId)
      .maybeSingle();

    if (!cartao || cartao.aluno_id !== venda.aluno_id || !cartao.ativo) {
      return json(400, { success: false, error: "cartao_inativo_ou_invalido" });
    }

    // documentos do contrato precisam estar aceitos antes de cobrar
    if (venda.plano_id) {
      const { data: contrato } = await admin
        .from("contratos")
        .select("id")
        .eq("plano_id", venda.plano_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contrato?.id) {
        const { count } = await admin
          .from("contratos_documentos")
          .select("id", { count: "exact", head: true })
          .eq("contrato_id", contrato.id)
          .eq("aceite", false);
        if ((count ?? 0) > 0) return json(400, { success: false, error: "contrato_nao_aceito" });
      }
    }

    const { data: cobranca, error: cobrancaErr } = await admin.functions.invoke("rede-cobrar-token", {
      body: {
        venda_id: venda.id,
        cartao_id: cartaoSalvoId,
        amount: Number(venda.valor_final ?? 0),
        installments: Math.max(1, Number(venda.parcelas ?? 1)),
      },
    });

    if (cobrancaErr) {
      console.error("[cobrar-link-pagamento] falha na cobrança:", String(cobrancaErr));
      return json(502, { success: false, error: "falha_comunicacao" });
    }

    if (!cobranca?.success) {
      return json(200, {
        success: false,
        error: cobranca?.error ?? null,
        return_message: cobranca?.return_message ?? null,
      });
    }

    // aprovado: encerra o link (mesma marcação do caminho da Corrida)
    await admin
      .from("links_pagamento")
      .update({ usado_em: new Date().toISOString() })
      .eq("venda_id", venda.id)
      .is("usado_em", null);

    // contrato do plano passa a vigorar
    if (venda.plano_id) {
      const { data: contrato } = await admin
        .from("contratos")
        .select("id, status")
        .eq("plano_id", venda.plano_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contrato?.id && contrato.status !== "ativo") {
        await admin.from("contratos").update({ status: "ativo" }).eq("id", contrato.id);
      }
    }

    return json(200, { success: true, tid: cobranca?.tid ?? null });
  } catch (err) {
    console.error("cobrar-link-pagamento error:", err);
    return json(500, { success: false, error: "erro_interno" });
  }
});
