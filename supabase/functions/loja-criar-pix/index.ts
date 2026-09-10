import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { interFetch, genTxid, onlyDigits } from "../_shared/inter.ts";
import { checkRateLimit } from "../_shared/loja-rate-limit.ts";

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

async function buscarQrCode(locId: string | number) {
  const { status, data, raw } = await interFetch(`/pix/v2/loc/${locId}/qrcode`, { method: "GET" });
  if (status >= 300) {
    console.error("[loja-criar-pix] falha qrcode", status, raw?.substring?.(0, 500));
    return null;
  }
  return data as { imagemQrcode?: string; qrcode?: string };
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
    if (!ok) return json(200, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id ?? "").trim();
    if (!pedidoId) return json(200, { ok: false, error: "pedido_nao_encontrado" });

    const chavePix = Deno.env.get("INTER_PIX_CHAVE");
    if (!chavePix) return json(200, { ok: false, error: "chave_pix_nao_configurada" });

    const { data: pedido } = await admin
      .from("pedidos")
      .select("id, nome, cpf, valor_final, status")
      .eq("id", pedidoId)
      .maybeSingle();

    if (!pedido) return json(200, { ok: false, error: "pedido_nao_encontrado" });
    if (pedido.status === "pago") return json(200, { ok: true, ja_pago: true });
    if (pedido.status !== "aguardando_pagamento") {
      return json(200, { ok: false, error: "pedido_nao_pagavel" });
    }

    // ---------- idempotência: reaproveitar cobrança ativa ----------
    const { data: existente } = await admin
      .from("pix_cobrancas")
      .select("id, txid, raw_response, status")
      .eq("pedido_id", pedidoId)
      .in("status", ["CRIADA", "ATIVA"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente?.txid) {
      const locId = (existente.raw_response as any)?.loc?.id;
      if (locId) {
        const qr = await buscarQrCode(locId);
        if (qr?.qrcode) {
          return json(200, {
            ok: true,
            txid: existente.txid,
            pix_copia_cola: qr.qrcode,
            qr_code_base64: qr.imagemQrcode ?? null,
            expira_em: 1800,
            reused: true,
          });
        }
      }
    }

    // ---------- nova cobrança imediata ----------
    const cpfDigits = onlyDigits(pedido.cpf);
    const valor = Number(pedido.valor_final ?? 0);
    const txid = genTxid();

    const payload = {
      calendario: { expiracao: 1800 },
      devedor: { cpf: cpfDigits, nome: pedido.nome },
      valor: { original: valor.toFixed(2) },
      chave: chavePix,
      solicitacaoPagador: "Compra Loja Fortem",
    };

    const { status, data, raw } = await interFetch(`/pix/v2/cob/${txid}`, {
      method: "PUT",
      json: payload,
    });
    if (status >= 300) {
      console.error("[loja-criar-pix] Inter /cob erro", status, raw?.substring?.(0, 800));
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    const locId = (data as any)?.loc?.id;
    const qr = locId ? await buscarQrCode(locId) : null;
    if (!qr?.qrcode) {
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    const { data: cobranca, error: insErr } = await admin
      .from("pix_cobrancas")
      .insert({
        pedido_id: pedidoId,
        txid,
        valor,
        status: (data as any)?.status ?? "ATIVA",
        descricao: "Compra Loja Fortem",
        raw_response: data,
      })
      .select("id")
      .single();

    if (insErr || !cobranca) {
      console.error("[loja-criar-pix] falha salvar cobranca:", insErr?.message);
      return json(200, { ok: false, error: "falha_criar_cobranca_pix" });
    }

    await admin
      .from("pedidos")
      .update({ forma_pagamento: "pix", cobranca_id: cobranca.id })
      .eq("id", pedidoId);

    return json(200, {
      ok: true,
      txid,
      pix_copia_cola: qr.qrcode,
      qr_code_base64: qr.imagemQrcode ?? null,
      expira_em: 1800,
    });
  } catch (err) {
    console.error("loja-criar-pix error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
