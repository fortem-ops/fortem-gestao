import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { interCobFetch } from "../_shared/inter-cob.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REDE_URLS: Record<string, string> = {
  sandbox: "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** ID de devolução Pix: alfanumérico, até 35 chars. */
function genDevolucaoId() {
  return ("dev" + crypto.randomUUID().replace(/-/g, "")).slice(0, 35);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // ---------- autenticação: somente staff (coordenador/admin) ----------
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json(401, { ok: false, error: "nao_autenticado" });

    const { data: autorizado } = await admin.rpc("is_coordinator_or_admin", { _user_id: user.id });
    if (!autorizado) return json(403, { ok: false, error: "sem_permissao" });

    const body = await req.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id ?? "").trim();
    if (!pedidoId) return json(200, { ok: false, error: "pedido_nao_informado" });

    const { data: pedido } = await admin
      .from("pedidos")
      .select("id, status, forma_pagamento, valor_final")
      .eq("id", pedidoId)
      .maybeSingle();

    if (!pedido) return json(200, { ok: false, error: "pedido_nao_encontrado" });
    if (pedido.status === "estornado") return json(200, { ok: false, error: "pedido_ja_estornado" });
    if (pedido.status !== "pago") return json(200, { ok: false, error: "pedido_nao_pago" });

    const valor = Number(pedido.valor_final ?? 0);
    if (!(valor > 0)) return json(200, { ok: false, error: "valor_invalido" });

    let detalhe: Record<string, unknown> = {};

    // ======================= CARTÃO (Rede) =======================
    if (pedido.forma_pagamento === "cartao_credito" || pedido.forma_pagamento === "cartao") {
      const { data: pag } = await admin
        .from("pagamentos_rede")
        .select("id, tid, amount")
        .eq("pedido_id", pedidoId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pag?.tid) return json(200, { ok: false, error: "pagamento_cartao_nao_encontrado" });

      const pv = Deno.env.get("REDE_PV") ?? "";
      const token = Deno.env.get("REDE_TOKEN") ?? "";
      const ambiente = (Deno.env.get("REDE_AMBIENTE") ?? "sandbox") as "sandbox" | "producao";
      if (!pv || !token) return json(200, { ok: false, error: "credenciais_rede_ausentes" });

      let accessToken: string;
      try {
        accessToken = await getRedeAccessToken(pv, token, ambiente);
      } catch (e) {
        console.error("[loja-estornar-pedido] auth rede", String(e));
        return json(200, { ok: false, error: "falha_autenticacao_rede" });
      }

      const amountCents = Number(pag.amount) > 0 ? Math.round(Number(pag.amount)) : Math.round(valor * 100);
      const baseUrl = REDE_URLS[ambiente] ?? REDE_URLS.sandbox;
      const resp = await fetch(`${baseUrl}/transactions/${pag.tid}/refunds`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountCents }),
      });
      const raw = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { parsed = { rawText: raw }; }

      const okCodes = ["00", "359", "360"];
      const returnCode = String(parsed?.returnCode ?? "");
      if (!okCodes.includes(returnCode)) {
        console.error("[loja-estornar-pedido] rede recusou", resp.status, raw.slice(0, 500));
        return json(200, {
          ok: false,
          error: "estorno_recusado_rede",
          detalhe: parsed?.returnMessage ?? raw.slice(0, 300),
        });
      }

      await admin.from("pagamentos_rede").update({ status: "refunded" }).eq("id", pag.id);
      detalhe = { meio: "cartao", tid: pag.tid, return_code: returnCode, amount: amountCents };

    // ======================= PIX (Banco Inter) =======================
    } else if (pedido.forma_pagamento === "pix") {
      const { data: cob } = await admin
        .from("pix_cobrancas")
        .select("id, txid, valor, raw_response")
        .eq("pedido_id", pedidoId)
        .eq("status", "LIQUIDADA")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cob?.txid) return json(200, { ok: false, error: "cobranca_pix_nao_encontrada" });

      // endToEndId: primeiro do payload salvo, senão consulta a cobrança no Inter
      let e2eId: string | undefined =
        (cob.raw_response as any)?.endToEndId ??
        (cob.raw_response as any)?.pix?.[0]?.endToEndId;

      if (!e2eId) {
        const consulta = await interCobFetch(`/pix/v2/cob/${cob.txid}`, { method: "GET" });
        e2eId = consulta.data?.pix?.[0]?.endToEndId;
      }
      if (!e2eId) return json(200, { ok: false, error: "e2e_pix_nao_encontrado" });

      const devolucaoId = genDevolucaoId();
      const { status, data, raw } = await interCobFetch(
        `/pix/v2/pix/${e2eId}/devolucao/${devolucaoId}`,
        { method: "PUT", json: { valor: Number(cob.valor ?? valor).toFixed(2) } },
      );

      if (status >= 300) {
        console.error("[loja-estornar-pedido] inter devolucao", status, raw?.slice?.(0, 500));
        const msg =
          data?.violacoes?.[0]?.razao ?? data?.detail ?? data?.title ?? raw?.slice?.(0, 300);
        return json(200, { ok: false, error: "devolucao_pix_recusada", detalhe: msg });
      }

      await admin
        .from("pix_cobrancas")
        .update({ status: "DEVOLVIDA", raw_response: data ?? cob.raw_response })
        .eq("id", cob.id);

      detalhe = { meio: "pix", e2e_id: e2eId, devolucao_id: devolucaoId, status_devolucao: data?.status };
    } else {
      return json(200, { ok: false, error: "forma_pagamento_nao_estornavel" });
    }

    await admin
      .from("pedidos")
      .update({
        status: "estornado",
        estornado_em: new Date().toISOString(),
        estornado_por: user.id,
        estorno_detalhe: detalhe,
      })
      .eq("id", pedidoId);

    return json(200, { ok: true, detalhe });
  } catch (err) {
    console.error("loja-estornar-pedido error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
