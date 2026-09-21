// Pix à vista para o checkout /corrida (apenas períodos Semestral e Anual).
// Reaproveita a infraestrutura do Banco Inter já validada na Loja (_shared/inter-cob.ts),
// sem tocar em nenhum comportamento existente da Loja.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { genTxid, onlyDigits } from "../_shared/inter.ts";
import { interCobFetch } from "../_shared/inter-cob.ts";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "criar-pix", 10, 60);
    if (!ok) return json(429, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    /** Link público de pagamento: a venda já existe, não se cria pedido novo. */
    const vendaExistenteId = typeof body?.venda_id === "string" && UUID_RE.test(body.venda_id.trim())
      ? body.venda_id.trim()
      : null;

    const periodo = String(body?.periodo ?? "");
    if (!vendaExistenteId && periodo !== "semestral" && periodo !== "anual") {
      return json(400, { ok: false, error: "pix_indisponivel_para_este_periodo" });
    }

    const chavePix = Deno.env.get("INTER_PIX_CHAVE");
    if (!chavePix) return json(500, { ok: false, error: "chave_pix_nao_configurada" });

    let vendaId: string;
    let contratoId: string | null = null;
    let alunoId: string | null = null;

    if (vendaExistenteId) {
      const { data: vendaLink } = await admin
        .from("vendas")
        .select("id, aluno_id, plano_id")
        .eq("id", vendaExistenteId)
        .maybeSingle();
      if (!vendaLink) return json(200, { ok: false, error: "venda_nao_encontrada" });
      vendaId = vendaLink.id;
      alunoId = vendaLink.aluno_id ?? null;
      const { data: contratoLink } = vendaLink.plano_id
        ? await admin
          .from("contratos")
          .select("id")
          .eq("plano_id", vendaLink.plano_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        : { data: null as any };
      contratoId = contratoLink?.id ?? null;
    } else {
      // ---------- 1. cria (ou reaproveita, via idempotency_key) o pedido ----------
      const criarResp = await admin.functions.invoke("corrida-criar-pedido", { body });
      const pedido: any = criarResp?.data ?? null;
      if (criarResp?.error || !pedido?.ok || !pedido?.venda_id) {
        console.error("[corrida-criar-pix] falha ao criar pedido:", String(criarResp?.error ?? pedido?.error ?? ""));
        return json(200, { ok: false, error: "falha_criar_pedido" });
      }
      vendaId = pedido.venda_id;
      contratoId = pedido.contrato_id ?? null;
      alunoId = pedido.aluno_id ?? null;
    }


    const { data: venda } = await admin
      .from("vendas")
      .select("id, valor_final, nome_snapshot, status_pagamento")
      .eq("id", vendaId)
      .maybeSingle();
    if (!venda) return json(200, { ok: false, error: "venda_nao_encontrada" });
    if (venda.status_pagamento === "pago") {
      return json(200, { ok: true, ja_pago: true, venda_id: vendaId, contrato_id: contratoId });
    }

    // ---------- 2. idempotência: reaproveita cobrança ativa da mesma venda ----------
    const { data: existente } = await admin
      .from("pix_cobrancas")
      .select("txid, raw_response, status")
      .eq("corrida_venda_id", vendaId)
      .in("status", ["CRIADA", "ATIVA"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente?.txid) {
      const copiaCola = (existente.raw_response as any)?.pixCopiaECola;
      if (copiaCola) {
        return json(200, {
          ok: true,
          reused: true,
          venda_id: vendaId,
          contrato_id: contratoId,
          txid: existente.txid,
          pix_copia_cola: copiaCola,
          expira_em: 1800,
        });
      }
    }

    // ---------- 3. cobrança imediata no Inter ----------
    const dp = body?.dadosPessoais ?? {};
    let cpfDigits = onlyDigits(String(dp?.cpf ?? ""));
    if (cpfDigits.length !== 11 && alunoId) {
      const { data: cpfRpc } = await admin.rpc("fn_reveal_cpf_service", { p_aluno_id: alunoId });
      if (typeof cpfRpc === "string") cpfDigits = onlyDigits(cpfRpc);
    }
    const nome = [dp?.nome, dp?.sobrenome].filter(Boolean).join(" ").trim() || "Cliente Fortem";

    const valor = Number(venda.valor_final ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) {
      return json(200, { ok: false, error: "valor_da_venda_invalido" });
    }

    const descricao = `Corrida Fortem — ${String(venda.nome_snapshot ?? "Plano").slice(0, 60)}`;
    const txid = genTxid();

    const { status, data, raw } = await interCobFetch(`/pix/v2/cob/${txid}`, {
      method: "PUT",
      json: {
        calendario: { expiracao: 1800 },
        devedor: cpfDigits.length === 11 ? { cpf: cpfDigits, nome } : undefined,
        valor: { original: valor.toFixed(2) },
        chave: chavePix,
        solicitacaoPagador: descricao.slice(0, 140),
      },
    });
    if (status >= 300) {
      console.error("[corrida-criar-pix] Inter /cob erro", status, raw?.substring?.(0, 800));
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    const copiaCola = (data as any)?.pixCopiaECola;
    if (!copiaCola) {
      console.error("[corrida-criar-pix] resposta sem pixCopiaECola", raw?.substring?.(0, 800));
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    const { error: insErr } = await admin.from("pix_cobrancas").insert({
      aluno_id: alunoId,
      corrida_venda_id: vendaId,
      txid,
      valor,
      status: (data as any)?.status ?? "ATIVA",
      descricao,
      raw_response: data,
    });
    if (insErr) {
      console.error("[corrida-criar-pix] falha salvar cobranca:", insErr.message);
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    return json(200, {
      ok: true,
      venda_id: vendaId,
      contrato_id: contratoId,
      txid,
      pix_copia_cola: copiaCola,
      expira_em: 1800,
    });
  } catch (err) {
    console.error("corrida-criar-pix error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
