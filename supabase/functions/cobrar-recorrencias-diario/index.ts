// cobrar-recorrencias-diario — cobrança automática das mensalidades de contratos
// com forma_pagamento = 'cartao_recorrencia' e cartão tokenizado vinculado.
//
// Orientada a COBRANÇA (não a venda): o valor cobrado é sempre cobrancas.valor e
// a idempotência é por cobranca_id em pagamentos_rede. Esta function NÃO toca em
// `vendas` em nenhum cenário.
//
// Executada por pg_cron (x-webhook-secret) logo após renovar-planos-mensais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedeAccessToken } from "../_shared/rede-auth.ts";
import {
  loadSecrets,
  resolveRedeBaseUrl,
  resolveTokenServiceUrl,
  toCentavos,
  buildReference,
  normalizeCardholderName,
  formatExpirationMonth,
} from "../_shared/rede-payload.ts";
import { cobrarComToken, motivoRecusaLegivel } from "../_shared/rede-recorrencia-core.ts";
import {
  normalizarTelefone,
  resolveNumberedTemplate,
  callSendWhatsApp,
  sanitizeTextParam,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const MAX_TENTATIVAS = 3;
const GATILHO_ALERTA = "cobranca_recusada";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

let _cachedSecret: string | null = null;

/** Autoriza cron (x-webhook-secret), service role, ou admin logado. */
async function autorizar(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-webhook-secret");
  if (provided) {
    if (!_cachedSecret) {
      const { data } = await admin.rpc("get_webhook_secret");
      _cachedSecret = typeof data === "string" ? data : null;
    }
    if (_cachedSecret && provided === _cachedSecret) return true;
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`) return true;

  if (auth.startsWith("Bearer ")) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (u?.user) {
      const { data: isA } = await admin.rpc("is_admin", { _user_id: u.user.id });
      if (isA) return true;
    }
  }
  return false;
}

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

async function logSistema(acao: string, mensagem: string, payload: unknown) {
  try {
    await admin.from("system_logs").insert({
      modulo: "cobrar-recorrencias-diario",
      acao,
      mensagem,
      payload,
    });
  } catch (e) {
    console.error("[cobrar-recorrencias] falha ao registrar system_logs:", String(e));
  }
}

/**
 * Alerta interno de recusa. Respeita ativo/modo_teste da config e sempre
 * registra em whatsapp_disparos_log. Disparado em TODAS as tentativas recusadas.
 */
async function alertarRecusa(params: {
  alunoId: string | null;
  alunoNome: string;
  valor: number;
  motivo: string;
  tentativa: number;
}) {
  const { data: cfg } = await admin
    .from("whatsapp_disparos_config")
    .select("id, nome, ativo, modo_teste, template_texto, template_meta_nome, telefone_fixo, destinatario")
    .eq("gatilho", GATILHO_ALERTA)
    .eq("destinatario", "fixo")
    .maybeSingle();

  if (!cfg) return { status: "sem_config" };
  if (!cfg.ativo) return { status: "config_inativa" };

  const hoje = hojeISO();
  const args = [
    sanitizeTextParam(params.alunoNome || "—"),
    formatBRL(params.valor),
    sanitizeTextParam(params.motivo || "—"),
    String(params.tentativa),
    formatDataBR(hoje),
  ];
  const mensagem = resolveNumberedTemplate(cfg.template_texto ?? "", args);
  const telefone = normalizarTelefone(cfg.telefone_fixo);

  if (cfg.modo_teste) {
    await admin.from("whatsapp_disparos_log").insert({
      config_id: cfg.id,
      aluno_id: params.alunoId,
      referencia_data: hoje,
      destinatario_telefone: telefone,
      destinatario_nome: "Alerta interno FORTEM",
      mensagem_enviada: mensagem,
      status: "bloqueado_teste",
    });
    return { status: "bloqueado_teste" };
  }

  if (!telefone) {
    await admin.from("whatsapp_disparos_log").insert({
      config_id: cfg.id,
      aluno_id: params.alunoId,
      referencia_data: hoje,
      destinatario_telefone: null,
      destinatario_nome: "Alerta interno FORTEM",
      mensagem_enviada: mensagem,
      status: "erro",
      erro_detalhe: "Config sem telefone_fixo",
    });
    return { status: "erro", reason: "sem_telefone" };
  }

  const send = cfg.template_meta_nome
    ? await callSendWhatsApp({
        to: telefone,
        template_name: cfg.template_meta_nome,
        language: "pt_BR",
        components: [{ type: "body", parameters: args.map((text) => ({ type: "text", text })) }],
      })
    : await callSendWhatsApp({ to: telefone, type: "text", text: mensagem });

  await admin.from("whatsapp_disparos_log").insert({
    config_id: cfg.id,
    aluno_id: params.alunoId,
    referencia_data: hoje,
    destinatario_telefone: telefone,
    destinatario_nome: "Alerta interno FORTEM",
    mensagem_enviada: mensagem,
    status: send.ok ? "enviado" : "erro",
    erro_detalhe: send.ok ? null : JSON.stringify({ error: send.error, details: send.details }),
  });

  return { status: send.ok ? "enviado" : "erro" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (!(await autorizar(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  try {
    const hoje = hojeISO();
    const agoraIso = new Date().toISOString();

    const { data: cobrancas, error: cobErr } = await admin
      .from("cobrancas")
      .select(
        "id, aluno_id, contrato_id, valor, data_vencimento, status, tentativas, " +
          "contratos!inner(id, status, forma_pagamento, cartao_token_id)",
      )
      .in("status", ["pendente", "atrasado"])
      .lte("data_vencimento", hoje)
      .lt("tentativas", MAX_TENTATIVAS)
      .or(`proxima_tentativa_em.is.null,proxima_tentativa_em.lte.${agoraIso}`)
      .eq("contratos.status", "ativo")
      .eq("contratos.forma_pagamento", "cartao_recorrencia")
      .not("contratos.cartao_token_id", "is", null)
      .order("data_vencimento", { ascending: true });

    if (cobErr) throw cobErr;

    const elegiveis = (cobrancas ?? []) as any[];
    const results: unknown[] = [];

    if (elegiveis.length === 0) {
      return new Response(JSON.stringify({ ok: true, elegiveis: 0, results }), { status: 200, headers });
    }

    // Credenciais e access_token: uma vez por execução.
    const secrets = await loadSecrets(admin);
    const ambiente = (secrets["rede_ambiente"] as "sandbox" | "producao") ?? "sandbox";
    const baseUrl = resolveRedeBaseUrl(ambiente);
    const tokenServiceBaseUrl = resolveTokenServiceUrl(ambiente);

    let accessToken: string;
    try {
      accessToken = await getRedeAccessToken(secrets["rede_pv"], secrets["rede_token"], ambiente);
    } catch (e) {
      await logSistema("auth_falhou", "Falha na autenticação Rede — nenhuma cobrança processada", { erro: String(e) });
      return new Response(JSON.stringify({ ok: false, error: "Falha na autenticação Rede" }), { status: 502, headers });
    }

    for (const cob of elegiveis) {
      const contrato = cob.contratos;
      const cartaoId: string = contrato.cartao_token_id;

      // ── Idempotência por cobrança ──────────────────────────
      const { data: jaPago } = await admin
        .from("pagamentos_rede")
        .select("id, tid, status")
        .eq("cobranca_id", cob.id)
        .in("status", ["approved", "pending"])
        .limit(1)
        .maybeSingle();
      if (jaPago) {
        results.push({ cobranca_id: cob.id, status: "idempotente", tid: jaPago.tid });
        continue;
      }

      // ── Cartão salvo ───────────────────────────────────────
      const { data: cartao } = await admin
        .from("cartoes_salvos")
        .select("id, token_rede, holder_name, expiration_month, expiration_year, ativo")
        .eq("id", cartaoId)
        .maybeSingle();

      if (!cartao?.ativo) {
        await logSistema(
          "cartao_inativo",
          `Cartão ${cartaoId} inativo ou inexistente — cobrança ${cob.id} não processada`,
          { cobranca_id: cob.id, contrato_id: contrato.id, cartao_id: cartaoId },
        );
        results.push({ cobranca_id: cob.id, status: "cartao_inativo" });
        continue;
      }

      // ── Tokenização ativa ──────────────────────────────────
      const { data: tokenizacao } = await admin
        .from("rede_tokenizacoes")
        .select("tokenization_id")
        .eq("cartao_salvo_id", cartaoId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenizacao?.tokenization_id) {
        // Problema de dado, não recusa do banco: não consome tentativa.
        await logSistema(
          "token_nao_encontrado",
          `Sem tokenization_id ativo para o cartão ${cartaoId} — cobrança ${cob.id} não processada`,
          { cobranca_id: cob.id, contrato_id: contrato.id, cartao_id: cartaoId },
        );
        results.push({ cobranca_id: cob.id, status: "token_nao_encontrado" });
        continue;
      }

      // ── Cobrança ───────────────────────────────────────────
      const valor = Number(cob.valor) || 0;
      const amountCentavos = toCentavos(valor);

      const resultado = await cobrarComToken({
        tokenizationId: tokenizacao.tokenization_id,
        amountCentavos,
        installments: 1,
        reference: buildReference(cob.id),
        cardNumber: cartao.token_rede,
        cardholderName: normalizeCardholderName(cartao.holder_name),
        expirationMonth: formatExpirationMonth(cartao.expiration_month),
        expirationYear: String(cartao.expiration_year),
        accessToken,
        baseUrl,
        tokenServiceBaseUrl,
      });

      // Falha técnica (rede fora do ar / criptograma): não é recusa do emissor,
      // não consome tentativa e não alerta — apenas fica registrada.
      if (resultado.errorKind) {
        await logSistema(
          resultado.errorKind === "network" ? "falha_comunicacao" : "criptograma_falhou",
          `Falha técnica na cobrança ${cob.id} (${resultado.stage}) — ${resultado.error}`,
          {
            cobranca_id: cob.id,
            contrato_id: contrato.id,
            cartao_id: cartaoId,
            tokenization_id: tokenizacao.tokenization_id,
            http_status: resultado.httpStatus,
            return_code: resultado.returnCode,
            return_message: resultado.returnMessage,
            raw_response: resultado.raw,
          },
        );
        results.push({ cobranca_id: cob.id, status: "falha_tecnica", etapa: resultado.stage });
        continue;
      }

      if (resultado.approved) {
        await admin.from("pagamentos_rede").insert({
          cobranca_id: cob.id,
          venda_id: null,
          amount: amountCentavos,
          installments: 1,
          kind: "token",
          tid: resultado.tid,
          nsu: resultado.nsu,
          authorization_code: resultado.authorizationCode,
          return_code: resultado.returnCode,
          return_message: resultado.returnMessage,
          status: "approved",
          raw_response: resultado.raw,
        });

        await admin
          .from("cobrancas")
          .update({
            status: "pago",
            data_pagamento: hoje,
            gateway: "rede",
            tid: resultado.tid,
            ultima_tentativa_em: new Date().toISOString(),
            proxima_tentativa_em: null,
            motivo_recusa: null,
            meio_registro: "gateway_webhook",
          })
          .eq("id", cob.id);

        results.push({ cobranca_id: cob.id, status: "aprovado", tid: resultado.tid, valor });
        continue;
      }

      // ── Recusada ───────────────────────────────────────────
      const tentativa = Number(cob.tentativas ?? 0) + 1;
      const motivo = motivoRecusaLegivel(resultado.returnCode, resultado.returnMessage);
      const proxima =
        tentativa < MAX_TENTATIVAS
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;

      await admin.from("pagamentos_rede").insert({
        cobranca_id: cob.id,
        venda_id: null,
        amount: amountCentavos,
        installments: 1,
        kind: "token",
        tid: resultado.tid,
        nsu: resultado.nsu,
        authorization_code: resultado.authorizationCode,
        return_code: resultado.returnCode,
        return_message: resultado.returnMessage,
        status: "denied",
        raw_response: resultado.raw,
      });

      await admin
        .from("cobrancas")
        .update({
          tentativas: tentativa,
          ultima_tentativa_em: new Date().toISOString(),
          proxima_tentativa_em: proxima,
          motivo_recusa: motivo,
        })
        .eq("id", cob.id);

      // returnCode 54: cartão vencido — desativa o cartão e desvincula de TODOS
      // os contratos que o usavam, não só o desta cobrança.
      if (resultado.desativarCartao) {
        await admin.from("cartoes_salvos").update({ ativo: false }).eq("id", cartaoId);
        const { data: desvinculados } = await admin
          .from("contratos")
          .update({ cartao_token_id: null })
          .eq("cartao_token_id", cartaoId)
          .select("id");
        await admin.from("planos").update({ cartao_token_id: null }).eq("cartao_token_id", cartaoId);
        await logSistema(
          "cartao_desativado",
          `Cartão ${cartaoId} desativado (returnCode 54) — ${desvinculados?.length ?? 0} contrato(s) desvinculado(s)`,
          { cartao_id: cartaoId, contratos: (desvinculados ?? []).map((c: any) => c.id) },
        );
      }

      const { data: aluno } = await admin
        .from("alunos")
        .select("nome")
        .eq("id", cob.aluno_id)
        .maybeSingle();

      const alerta = await alertarRecusa({
        alunoId: cob.aluno_id ?? null,
        alunoNome: aluno?.nome ?? "Aluno",
        valor,
        motivo,
        tentativa,
      });

      results.push({
        cobranca_id: cob.id,
        status: "recusado",
        tentativa,
        motivo,
        return_code: resultado.returnCode,
        esgotou_tentativas: tentativa >= MAX_TENTATIVAS,
        alerta: alerta.status,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, elegiveis: elegiveis.length, results }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[cobrar-recorrencias-diario]", e);
    await logSistema("erro_execucao", "Erro na execução do cron de cobrança", { erro: String(e) });
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), { status: 500, headers });
  }
});
