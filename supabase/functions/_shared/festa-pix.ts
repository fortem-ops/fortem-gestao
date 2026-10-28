// Festa 10 anos: cobrança PIX imediata (Inter, credenciais de cobrança da Loja/Corrida) e baixa idempotente.
// Não toca em pix_cobrancas, recorrência nem checkout dos planos.
import { interCobFetch } from "./inter-cob.ts";
import { valorPagoFestaCorreto } from "./festa-valor.ts";

export const FESTA_TXID_PREFIXO = "FESTA10";
export const FESTA_PRAZO_FIM = new Date("2026-11-06T23:59:59.999-03:00");

export function ehTxidFesta(txid: string | null | undefined) {
  return typeof txid === "string" && txid.startsWith(FESTA_TXID_PREFIXO);
}

function txidFesta() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(25));
  return FESTA_TXID_PREFIXO + Array.from(b, (x) => abc[x % abc.length]).join("");
}

/**
 * Regra única: quem ficou devendo recebe um código PIX.
 * Vale para cadastro sem voucher e para voucher de desconto parcial (total > 0).
 * Não confunde com "isento" (total 0), que não gera cobrança.
 */
export function deveGerarPix(status: string | null | undefined, totalCentavos: number | null | undefined) {
  return status === "aguardando_pagamento" && Number(totalCentavos) > 0;
}

/** Cria cobrança imediata válida até o fim do prazo (mínimo 1 h). */
export async function criarPixFesta(sup: any, conf: { id: string; nome: string; total_centavos: number }) {
  const chave = Deno.env.get("INTER_PIX_CHAVE") ?? "";
  if (!chave) return { ok: false as const, erro: "chave_pix_ausente" };
  const restante = Math.floor((FESTA_PRAZO_FIM.getTime() - Date.now()) / 1000);
  const expiracao = Math.max(3600, restante);
  const txid = txidFesta();
  const { status, data, raw } = await interCobFetch(`/pix/v2/cob/${txid}`, {
    method: "PUT",
    json: {
      calendario: { expiracao },
      valor: { original: (conf.total_centavos / 100).toFixed(2) },
      chave,
      solicitacaoPagador: "FORTEM 10 anos - confirmacao de presenca",
    },
  });
  if (status >= 300 || !(data as any)?.pixCopiaECola) {
    console.error("[festa-pix] Inter /cob erro", status, String(raw ?? "").slice(0, 400));
    await sup.from("festa_eventos").insert({ confirmacao_id: conf.id, acao: "pix_falhou", detalhes: { http: status } });
    return { ok: false as const, erro: "falha_inter" };
  }
  const copia = (data as any).pixCopiaECola as string;
  const expira = new Date(Date.now() + expiracao * 1000).toISOString();
  await sup.from("festa_confirmacoes").update({ txid, pix_copia_e_cola: copia, pix_expira_em: expira }).eq("id", conf.id);
  await sup.from("festa_eventos").insert({ confirmacao_id: conf.id, acao: "pix_criado", detalhes: { txid } });
  return { ok: true as const, txid, copia_e_cola: copia, expira_em: expira };
}

/** Baixa idempotente: só confirma se o valor recebido bate com o total calculado no servidor. */
export async function baixarPixFesta(sup: any, txid: string, valorRecebido: number | string | null | undefined, fonte: string) {
  const { data: conf } = await sup.from("festa_confirmacoes")
    .select("id, status, total_centavos").eq("txid", txid).maybeSingle();
  if (!conf) { await registrarSemConfirmacao(sup, txid, valorRecebido, fonte, "pagamento_sem_confirmacao"); return { ok: true, motivo: "sem_confirmacao" }; }
  if (conf.status === "cancelado") { await registrarSemConfirmacao(sup, txid, valorRecebido, fonte, "pagamento_em_cancelada", conf.id); return { ok: true, motivo: "cancelada" }; }
  if (conf.status !== "aguardando_pagamento") return { ok: true, motivo: "ja_tratado" };
  const centavos = Math.round(Number(valorRecebido) * 100);
  if (!valorPagoFestaCorreto(valorRecebido, conf.total_centavos)) {
    await sup.from("festa_eventos").insert({ confirmacao_id: conf.id, acao: "valor_divergente", detalhes: { txid, recebido_centavos: centavos, esperado_centavos: conf.total_centavos, fonte } });
    return { ok: false, motivo: "valor_divergente" };
  }
  const { data: upd } = await sup.from("festa_confirmacoes")
    .update({ status: "confirmado", pago_em: new Date().toISOString(), pago_valor_centavos: centavos, pagamento_forma: "pix" })
    .eq("id", conf.id).eq("status", "aguardando_pagamento").select("id");
  if (upd?.length) await sup.from("festa_eventos").insert({ confirmacao_id: conf.id, acao: "pago_pix", detalhes: { txid, fonte } });
  return { ok: true, motivo: "baixado" };
}

/** Consulta de segurança no Inter, caso o aviso não chegue. */
export async function conferirPixFesta(sup: any, txid: string) {
  const { status, data } = await interCobFetch(`/pix/v2/cob/${txid}`, { method: "GET" });
  if (status >= 300) return { ok: false };
  const d = data as any;
  if (d?.status === "CONCLUIDA") {
    const valor = Array.isArray(d.pix) && d.pix[0]?.valor ? d.pix[0].valor : d?.valor?.original;
    return baixarPixFesta(sup, txid, valor, "consulta");
  }
  return { ok: true, motivo: d?.status ?? "desconhecido" };
}

/** Pagamento sem confirmação ativa: não confirma nada, só registra (uma vez por txid) para a equipe conciliar. */
async function registrarSemConfirmacao(sup: any, txid: string, valor: unknown, fonte: string, acao: string, confirmacaoId: string | null = null) {
  const { data: ja } = await sup.from("festa_eventos").select("id").eq("acao", acao).eq("detalhes->>txid", txid).limit(1);
  if (ja?.length) return;
  const centavos = Math.round(Number(valor) * 100);
  await sup.from("festa_eventos").insert({
    confirmacao_id: confirmacaoId, acao,
    detalhes: { txid, valor_centavos: Number.isFinite(centavos) ? centavos : null, recebido_em: new Date().toISOString(), fonte },
  });
}

/** Cancela no Inter a cobrança pendente (REMOVIDA_PELO_USUARIO_RECEBEDOR). Se já tiver sido paga, dá baixa e avisa. */
export async function cancelarPixFesta(sup: any, conf: { id: string; txid: string | null }, uid: string) {
  if (!conf.txid) return { ok: true as const, pago: false };
  const { status, data } = await interCobFetch(`/pix/v2/cob/${conf.txid}`, { method: "GET" });
  const atual = (data as any)?.status;
  if (status < 300 && atual === "CONCLUIDA") {
    await conferirPixFesta(sup, conf.txid);
    return { ok: false as const, pago: true };
  }
  if (status < 300 && atual === "ATIVA") {
    const r = await interCobFetch(`/pix/v2/cob/${conf.txid}`, { method: "PATCH", json: { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" } });
    if (r.status >= 300) {
      console.error("[festa-pix] cancelar erro", r.status, String(r.raw ?? "").slice(0, 300));
      return { ok: false as const, pago: false };
    }
  } else if (status >= 300 && status !== 404) {
    return { ok: false as const, pago: false };
  }
  await sup.from("festa_confirmacoes").update({ pix_copia_e_cola: null, pix_expira_em: null }).eq("id", conf.id);
  await sup.from("festa_eventos").insert({ confirmacao_id: conf.id, acao: "pix_cancelado", usuario_id: uid, detalhes: { txid: conf.txid, status_inter_antes: atual ?? null } });
  return { ok: true as const, pago: false };
}
