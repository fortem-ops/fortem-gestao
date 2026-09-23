// ─────────────────────────────────────────────────────────────
// Cobrança de UM CLIQUE com cartão já salvo (admin apenas).
//
// O cliente envia apenas venda_id, cartao_id, installments e
// idempotency_key. Valor, token e tokenização SEMPRE vêm do servidor.
// Nunca devolve token_rede nem tokenization_id.
//
// Não lê nem escreve sistema_config.cobranca_recorrente_ativa — esta
// cobrança é manual, disparada pelo clique do usuário.
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import {
  loadSecrets,
  resolveRedeBaseUrl,
  resolveTokenServiceUrl,
  calcularAmountCentavos,
  isRecorrencia as isVendaRecorrencia,
  normalizarPeriodoMeses,
  buildReference,
  normalizeCardholderName,
  formatExpirationMonth,
} from "../_shared/rede-payload.ts";
import { cobrarComToken, motivoRecusaLegivel } from "../_shared/rede-recorrencia-core.ts";
import { atualizarVendaEParcelas, criarContratoPosAprovacao } from "../_shared/venda-pos-aprovacao.ts";
import { validarCobrancaSalvo } from "../_shared/cobrar-salvo-validacao.ts";
import {
  decidirConflitoReserva,
  isUniqueViolation,
  respostaIdempotente,
} from "../_shared/cobrar-salvo-reserva.ts";

const MAX_TENTATIVAS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── 1. Autenticação ───────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "") ?? "",
  );
  if (authErr || !user) return json({ error: "Não autenticado" }, 401);

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
  if (!isAdmin) return json({ error: "Sem permissão — apenas administradores" }, 403);

  // ── 2. Entrada ────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Body JSON inválido" }, 400);

  const venda_id = body.venda_id;
  const cartao_id = body.cartao_id;
  const idempotency_key = body.idempotency_key;
  const installments = Number(body.installments ?? 1);

  if (!UUID_RE.test(String(venda_id ?? "")) || !UUID_RE.test(String(cartao_id ?? ""))) {
    return json({ error: "Campos obrigatórios ausentes ou inválidos" }, 400);
  }
  if (!UUID_RE.test(String(idempotency_key ?? ""))) {
    return json({ error: "Chave de idempotência inválida" }, 400);
  }
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
    return json({ error: "Número de parcelas inválido (1 a 12)" }, 400);
  }

  // ── 3. Idempotência por chave — devolve o resultado da primeira ──
  const { data: mesmaChave } = await supabase
    .from("pagamentos_rede")
    .select("tid, status, return_code, return_message, amount")
    .eq("idempotency_key", idempotency_key)
    .maybeSingle();
  if (mesmaChave) {
    return json({
      success: mesmaChave.status === "approved",
      idempotente: true,
      tid: mesmaChave.tid,
      valor_centavos: mesmaChave.amount,
      motivo: mesmaChave.status === "approved"
        ? null
        : motivoRecusaLegivel(mesmaChave.return_code, mesmaChave.return_message),
    });
  }

  // ── 4. Venda + cartão + tokenização ───────────────────────
  const { data: venda } = await supabase.from("vendas")
    .select("id, aluno_id, status_pagamento, valor_final, valor, desconto, tipo_cobranca, taxa_mensal, catalogo_id, data_venda")
    .eq("id", venda_id).maybeSingle();

  const { data: cartao } = await supabase.from("cartoes_salvos")
    .select("id, aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo")
    .eq("id", cartao_id).maybeSingle();

  const { data: tokenizacao } = await supabase
    .from("rede_tokenizacoes")
    .select("tokenization_id")
    .eq("cartao_salvo_id", cartao_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pagamentoExistente } = await supabase
    .from("pagamentos_rede")
    .select("tid, status")
    .eq("venda_id", venda_id)
    .in("status", ["approved", "pending"])
    .maybeSingle();

  const validacao = validarCobrancaSalvo({
    venda,
    cartao,
    tokenizationId: tokenizacao?.tokenization_id ?? null,
    pagamentoExistente,
    agora: new Date(),
  });
  if (!validacao.ok) {
    if (validacao.codigo === "ja_cobrada") {
      return json({ success: true, idempotente: true, tid: validacao.tid ?? null });
    }
    return json({ error: validacao.motivo }, 400);
  }

  // ── 5. Limite de tentativas (por aluno) ───────────────────
  const { data: rlOk } = await supabase.rpc("fn_check_rate_limit", {
    p_aluno_id: venda!.aluno_id,
    p_janela: Math.floor(Date.now() / 60000),
    p_limite: MAX_TENTATIVAS,
  });
  if (!rlOk) return json({ error: "Limite de tentativas excedido. Aguarde 1 minuto." }, 429);

  // ── 6. Valor calculado no servidor ────────────────────────
  let periodoMeses = 1;
  if (isVendaRecorrencia(venda as any)) {
    const { data: plano } = await supabase.from("planos_catalogo")
      .select("periodo_meses").eq("id", (venda as any)?.catalogo_id).maybeSingle();
    periodoMeses = normalizarPeriodoMeses((plano as any)?.periodo_meses);
  }
  const amount = calcularAmountCentavos(venda as any, periodoMeses);
  if (amount <= 0) return json({ error: "Valor da venda inválido ou zerado" }, 400);

  // ── 7. Credenciais + cobrança ─────────────────────────────
  const secrets = await loadSecrets(supabase);
  const pv = secrets["rede_pv"], token = secrets["rede_token"];
  if (!pv || !token) return json({ error: "Credenciais Rede não configuradas" }, 500);
  const ambiente = (secrets["rede_ambiente"] as "sandbox" | "producao") ?? "sandbox";

  let accessToken: string;
  try {
    accessToken = await getRedeAccessToken(pv, token, ambiente);
  } catch (e) {
    console.error("[rede-cobrar-salvo] falha de autenticação Rede:", String(e));
    return json({ success: false, error: "Falha na comunicação com a operadora" }, 502);
  }

  const resultado = await cobrarComToken({
    tokenizationId: tokenizacao!.tokenization_id,
    amountCentavos: amount,
    installments,
    reference: buildReference(venda_id),
    cardNumber: cartao!.token_rede,
    cardholderName: normalizeCardholderName(cartao!.holder_name),
    expirationMonth: formatExpirationMonth(cartao!.expiration_month),
    expirationYear: String(cartao!.expiration_year),
    accessToken,
    baseUrl: resolveRedeBaseUrl(ambiente),
    tokenServiceBaseUrl: resolveTokenServiceUrl(ambiente),
  });

  // ── 8. Falha técnica: nada alterado além de log ───────────
  if (resultado.errorKind) {
    console.error(
      "[rede-cobrar-salvo] falha técnica —", resultado.stage,
      "http:", resultado.httpStatus, "returnCode:", resultado.returnCode,
    );
    try {
      await supabase.from("system_logs").insert({
        modulo: "rede-cobrar-salvo",
        acao: resultado.stage === "cryptogram" ? "criptograma_falhou" : "transacao_falhou",
        mensagem: `Falha ${resultado.errorKind} na etapa ${resultado.stage} — HTTP ${resultado.httpStatus}`,
        payload: {
          venda_id, cartao_id,
          return_code: resultado.returnCode,
          return_message: resultado.returnMessage,
          http_status: resultado.httpStatus,
        },
      });
    } catch (e) {
      console.error("[rede-cobrar-salvo] falha ao registrar system_logs:", String(e));
    }
    return json({ success: false, error: "Erro de comunicação com a operadora. Nada foi cobrado." }, 502);
  }

  const approved = resultado.approved;

  // ── 9. Registro da transação ──────────────────────────────
  const { error: insErr } = await supabase.from("pagamentos_rede").insert({
    venda_id,
    created_by: user.id,
    idempotency_key,
    amount,
    installments,
    kind: "token",
    tid: resultado.tid,
    nsu: resultado.nsu,
    authorization_code: resultado.authorizationCode,
    return_code: resultado.returnCode,
    return_message: resultado.returnMessage,
    status: approved ? "approved" : "denied",
    raw_response: resultado.raw,
  });
  if (insErr) console.error("[rede-cobrar-salvo] insert pagamentos_rede:", insErr.message);

  // ── 10. Pós-aprovação (venda, parcelas, contrato) ─────────
  await atualizarVendaEParcelas(supabase, venda_id, approved);
  if (approved) {
    await criarContratoPosAprovacao(supabase, {
      vendaId: venda_id,
      alunoId: venda!.aluno_id,
      venda,
      cartaoTokenId: cartao_id,
      servicosInclusos: null,
    });
  }

  // Cartão vencido (código 54): desativa o cartão salvo, como no fluxo existente
  if (resultado.desativarCartao) {
    await supabase.from("cartoes_salvos").update({ ativo: false }).eq("id", cartao_id);
    await supabase.from("planos").update({ cartao_token_id: null }).eq("cartao_token_id", cartao_id);
  }

  return json({
    success: approved,
    tid: resultado.tid,
    valor_centavos: amount,
    installments,
    brand: cartao!.brand,
    last4: cartao!.last4,
    motivo: approved ? null : motivoRecusaLegivel(resultado.returnCode, resultado.returnMessage),
  });
});
