// Cobrança de pedido da Loja no cartão salvo do aluno, disparada pela equipe
// (Nova Venda > Produtos). Só admin/coordenador. Valor sempre do pedido no banco.
// Reserva uma linha "pending" em pagamentos_rede antes de chamar a Rede (índice
// único por pedido): nunca cobra duas vezes. Recusa mantém o pedido pendente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { dispararAvisoRecusa } from "../_shared/avisar-recusa.ts";

const REDE_URLS = { sandbox: "https://sandbox-erede.useredecloud.com.br/v2", producao: "https://api.userede.com.br/erede/v2" };
const TOKEN_URLS = {
  sandbox: "https://rl7-sandbox-api.useredecloud.com.br/token-service/oauth/v2/cryptogram",
  producao: "https://api.userede.com.br/redelabs/token-service/oauth/v2/cryptogram",
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { success: false, error: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json(401, { success: false, error: "nao_autenticado" });
    const { data: pode } = await admin.rpc("is_coordinator_or_admin", { _user_id: u.user.id });
    if (pode !== true) return json(403, { success: false, error: "sem_permissao" });

    const body = await req.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id ?? "");
    const cartaoId = String(body?.cartao_id ?? "");
    const parcelas = Math.min(12, Math.max(1, Math.trunc(Number(body?.parcelas ?? 1)) || 1));
    if (!UUID.test(pedidoId) || !UUID.test(cartaoId)) return json(400, { success: false, error: "campos_invalidos" });

    const { data: pedido } = await admin.from("pedidos").select("id, aluno_id, status, valor_final").eq("id", pedidoId).maybeSingle();
    if (!pedido) return json(404, { success: false, error: "pedido_nao_encontrado" });
    if (pedido.status === "pago") return json(200, { success: true, idempotente: true });
    if (pedido.status !== "aguardando_pagamento") return json(409, { success: false, error: "pedido_nao_pagavel" });

    const { data: cartao } = await admin.from("cartoes_salvos")
      .select("id, aluno_id, token_rede, holder_name, expiration_month, expiration_year, ativo").eq("id", cartaoId).maybeSingle();
    if (!cartao?.ativo || !cartao.token_rede || cartao.aluno_id !== pedido.aluno_id) {
      return json(400, { success: false, error: "cartao_invalido" });
    }
    const { data: tk } = await admin.from("rede_tokenizacoes").select("tokenization_id")
      .eq("cartao_salvo_id", cartaoId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!tk?.tokenization_id) return json(409, { success: false, error: "cartao_sem_tokenizacao" });

    const amount = Math.round(Number(pedido.valor_final ?? 0) * 100);
    if (!(amount > 0)) return json(400, { success: false, error: "valor_invalido" });

    // reserva atômica: índice único (pedido_id) para approved/pending
    const { data: reserva, error: resErr } = await admin.from("pagamentos_rede").insert({
      pedido_id: pedidoId, amount, installments: parcelas, kind: "token", status: "pending", created_by: u.user.id,
    }).select("id").single();
    if (resErr || !reserva) {
      return json(409, { success: false, error: "cobranca_em_andamento", mensagem: "Já existe uma cobrança aprovada ou em andamento para este pedido. Confira antes de tentar de novo." });
    }

    const pv = (Deno.env.get("REDE_PV") ?? "").trim();
    const redeToken = (Deno.env.get("REDE_TOKEN") ?? "").trim();
    const amb = (Deno.env.get("REDE_AMBIENTE") ?? "sandbox").trim() === "producao" ? "producao" : "sandbox";
    const liberar = async (msg: string) => {
      await admin.from("pagamentos_rede").update({ status: "denied", return_message: msg }).eq("id", reserva.id);
    };
    let access: string;
    try { access = await getRedeAccessToken(pv, redeToken, amb); } catch {
      await liberar("falha_autenticacao_rede");
      return json(502, { success: false, error: "falha_autenticacao_rede" });
    }

    // criptograma (antes de qualquer cobrança: falha aqui é segura para liberar)
    let crypto: { returnCode?: string; cryptogramInfo?: { tokenCryptogram?: string } } | null = null;
    try {
      const r = await fetch(`${TOKEN_URLS[amb]}/${tk.tokenization_id}`, {
        method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: false }),
      });
      crypto = await r.json().catch(() => null);
    } catch { /* tratado abaixo */ }
    const cryptogram = crypto?.cryptogramInfo?.tokenCryptogram;
    if (crypto?.returnCode !== "00" || !cryptogram) {
      await liberar("falha_criptograma");
      return json(502, { success: false, error: "falha_criptograma" });
    }

    const payload = {
      capture: true, kind: "credit", reference: pedidoId.replace(/-/g, "").slice(0, 20), amount, installments: parcelas,
      storageCard: "2", cardNumber: cartao.token_rede,
      expirationMonth: String(cartao.expiration_month).padStart(2, "0"), expirationYear: String(cartao.expiration_year),
      cardholderName: String(cartao.holder_name || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      tokenCryptogram: cryptogram,
    };
    let resp: Record<string, unknown> | null = null;
    try {
      const r = await fetch(`${REDE_URLS[amb]}/transactions`, {
        method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      resp = await r.json().catch(() => null);
    } catch { resp = null; }

    if (!resp || typeof resp.returnCode !== "string") {
      // resultado incerto: mantém "pending" para travar nova tentativa até conferir na Rede
      await admin.from("system_logs").insert({ modulo: "loja-cobrar-pedido-equipe", acao: "resultado_incerto",
        mensagem: `Cobrança do pedido ${pedidoId} sem resposta da Rede. Conferir antes de nova tentativa.`, payload: { pedido_id: pedidoId, pagamento_id: reserva.id } });
      return json(502, { success: false, error: "resultado_incerto", mensagem: "Sem resposta da Rede. Confira na Rede antes de tentar de novo." });
    }
    const code = resp.returnCode as string;
    const approved = code === "00";
    await admin.from("pagamentos_rede").update({
      status: approved ? "approved" : "denied", tid: resp.tid ?? null, nsu: resp.nsu ?? null,
      authorization_code: resp.authorizationCode ?? null, return_code: code, return_message: resp.returnMessage ?? null, raw_response: resp,
    }).eq("id", reserva.id);

    if (approved) {
      await admin.from("pedidos").update({ status: "pago", forma_pagamento: "cartao_credito", cobranca_id: reserva.id }).eq("id", pedidoId);
    } else {
      dispararAvisoRecusa(admin, { fluxo: "loja", etapa: "cobranca", pedido_id: pedidoId, aluno_id: pedido.aluno_id, return_code: code, return_message: (resp.returnMessage as string) ?? null });
      if (code === "54") await admin.from("cartoes_salvos").update({ ativo: false }).eq("id", cartaoId);
    }
    return json(200, { success: approved, return_code: code, return_message: resp.returnMessage ?? null });
  } catch (e) {
    console.error("[loja-cobrar-pedido-equipe]", String(e));
    return json(500, { success: false, error: "erro_interno" });
  }
});
