/**
 * Estorno (total ou parcial) de uma cobrança paga no cartão pela Rede.
 *
 * Regras:
 * - Só admin autenticado.
 * - O servidor é a fonte da verdade: TID, valor pago e saldo estornável vêm do banco.
 * - Reserva atômica (trava de linha + idempotency_key) antes de chamar a Rede.
 * - Só marca como estornado depois do "ok" da Rede; recusa/erro apaga a reserva.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import { executarRefundRede, loadRedeSecrets, redeBaseUrl } from "../_shared/rede-refund.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const erro = (msg: string, status = 400, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ success: false, error: msg, ...extra }), { status, headers });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace("Bearer ", "") ?? "");
  if (!user) return erro("Não autenticado", 401);

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
  if (!isAdmin) return erro("Apenas administradores podem estornar cobranças", 403);

  const body = await req.json().catch(() => ({}));
  const cobrancaId = typeof body.cobranca_id === "string" ? body.cobranca_id.trim() : "";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  const tipo = body.tipo === "parcial" ? "parcial" : "total";
  const valorInformado = body.valor != null ? Number(body.valor) : null;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(cobrancaId)) return erro("Cobrança inválida");
  if (!UUID_RE.test(idempotencyKey)) return erro("Chave de idempotência inválida");
  if (motivo.length < 10) return erro("Informe o motivo do estorno (mínimo 10 caracteres)");
  if (tipo === "parcial" && (!valorInformado || !isFinite(valorInformado) || valorInformado <= 0)) {
    return erro("Informe um valor de estorno maior que zero");
  }

  // Saldo e TID sempre do banco — nada do cliente.
  const { data: saldoRows, error: saldoErr } = await supabase
    .rpc("fn_cobranca_saldo_estornavel", { _cobranca_id: cobrancaId });
  if (saldoErr) return erro("Não foi possível conferir o saldo da cobrança", 500, { detalhe: saldoErr.message });
  const saldoInfo = Array.isArray(saldoRows) ? saldoRows[0] : saldoRows;
  if (!saldoInfo) return erro("Cobrança não encontrada", 404);

  const saldo = Number(saldoInfo.saldo_estornavel ?? 0);
  const valorEstorno = tipo === "total" ? saldo : Number(valorInformado);
  if (valorEstorno <= 0) return erro("Esta cobrança já foi totalmente estornada");
  if (valorEstorno > saldo + 0.001) {
    return erro(`Valor acima do saldo disponível para estorno (R$ ${saldo.toFixed(2)})`);
  }

  // Reserva atômica (trava a cobrança e valida o saldo de novo no banco).
  const { data: reservaData, error: reservaErr } = await supabase.rpc("fn_estorno_reservar", {
    _cobranca_id: cobrancaId,
    _idempotency_key: idempotencyKey,
    _valor: Number(valorEstorno.toFixed(2)),
    _user_id: user.id,
  });
  if (reservaErr) return erro("Não foi possível iniciar o estorno", 500, { detalhe: reservaErr.message });

  const reserva = reservaData as Record<string, unknown>;
  if (!reserva?.ok) {
    return erro(String(reserva?.erro ?? "Não foi possível iniciar o estorno"), 409, {
      duplicado: reserva?.duplicado === true,
    });
  }

  const pagamentoId = String(reserva.pagamento_id);
  const tid = String(reserva.tid);
  const amountCents = Number(reserva.amount_cents);

  const desfazer = async () => {
    await supabase.rpc("fn_estorno_cancelar_reserva", { _pagamento_id: pagamentoId });
  };

  const { pv, token, ambiente } = await loadRedeSecrets(supabase);
  let accessToken: string;
  try {
    accessToken = await getRedeAccessToken(pv, token, ambiente);
  } catch (e) {
    await desfazer();
    return erro("Falha na autenticação com a Rede. Nada foi estornado.", 502, { detalhe: String(e) });
  }

  const r = await executarRefundRede({
    accessToken,
    baseUrl: redeBaseUrl(ambiente),
    tid,
    amountCents,
    logPrefix: "[estornar-cobranca]",
  });

  if (r.transportError) {
    await desfazer();
    return erro("Erro de comunicação com a Rede. Nada foi alterado — tente novamente.", 502, {
      detalhe: r.transportError,
    });
  }

  if (!r.ok) {
    await desfazer();
    const msg = r.returnMessage ?? r.rawText.slice(0, 300) ?? "sem detalhe";
    return erro(`A operadora recusou o estorno: ${msg}`, 422, {
      return_code: r.returnCode,
      rede_http_status: r.httpStatus,
    });
  }

  const { data: confData, error: confErr } = await supabase.rpc("fn_estorno_confirmar", {
    _pagamento_id: pagamentoId,
    _motivo: motivo,
    _user_id: user.id,
    _nsu: r.nsu ?? null,
    _authorization_code: r.authorizationCode ?? null,
    _return_code: r.returnCode ?? null,
    _return_message: r.returnMessage ?? null,
    _raw: r.raw ?? {},
  });
  if (confErr) {
    // A Rede já estornou: NÃO desfazemos a reserva, apenas sinalizamos.
    console.error("[estornar-cobranca] estorno confirmado na Rede mas falhou ao registrar:", confErr.message);
    return erro(
      "O estorno foi feito na operadora, mas houve falha ao registrar no sistema. Avise o suporte antes de tentar de novo.",
      500,
      { detalhe: confErr.message, tid, pagamento_id: pagamentoId },
    );
  }

  const conf = confData as Record<string, unknown>;

  return new Response(JSON.stringify({
    success: true,
    comprovante: {
      pagamento_id: pagamentoId,
      cobranca_id: cobrancaId,
      aluno_id: reserva.aluno_id,
      numero_ciclo: reserva.numero_ciclo,
      valor_estornado: conf.valor_estornado,
      valor_original: conf.valor_pago,
      total_estornado: conf.total_estornado,
      saldo_restante: conf.saldo_restante,
      integral: conf.integral,
      cobranca_status: conf.cobranca_status,
      tid,
      nsu: r.nsu ?? null,
      authorization_code: r.authorizationCode ?? null,
      return_code: r.returnCode ?? null,
      return_message: r.returnMessage ?? null,
      motivo,
      executado_em: new Date().toISOString(),
      executado_por: user.id,
    },
  }), { status: 200, headers });
});
