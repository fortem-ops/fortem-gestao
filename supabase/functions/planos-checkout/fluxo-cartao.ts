// Fluxo do cartão real do /planos (tokenização Rede → criptograma → transação).
// Dependências injetadas: em teste a Rede é falsa; em produção só roda com fn_checkout_2027_cartao_real = true.
// Número, CVV e CPF só em memória: nunca vão para banco nem log. O nome do titular (exigido pela
// transação com token, como na Loja) fica só em rede_tokenizacoes.cardholder_name, nunca em tentativas,
// logs, raw ou respostas ao navegador.
import {
  INTERVALO_CONSULTA_MS, PRAZO_COBRANDO_MS, PRAZO_COBRAR_MS, PRAZO_TOKEN_MS,
  mapearConsulta, mapearTransacao, mascararTid, referencia, sanitizarRaw, validadeToken, type DadosCartao,
} from "./cartao.ts";
import { consultaSegura, estadoToken } from "../_shared/planos-cartao-token.ts";

export type TentativaCartao = {
  id: string; proposta_id: string; status: string; motivo: string | null; valor_centavos: number; parcelas: number;
  simulado: boolean; tokenizacao_id: string | null; consultado_em: string | null; created_at: string; updated_at: string;
};
type Resp = { httpStatus: number; parsed: any; erroRede: boolean };

export type Deps = {
  rede: {
    tokenizar(d: DadosCartao): Promise<{ ok: boolean; tokenizationId: string | null }>;
    consultarToken(tokenizationId: string): Promise<Resp>;
    cobrar(i: { tokenizationId: string; tokenCode: string; mes: string; ano: string; nome: string; centavos: number; parcelas: number; reference: string; softDescriptor: string }): Promise<Resp & { etapa: "criptograma" | "transacao" }>;
    consultarPorReferencia(reference: string): Promise<Resp>;
  };
  db: {
    tentativa(id: string): Promise<TentativaCartao | null>;
    /** Liga o token à tentativa (linha nova em rede_tokenizacoes: proposta_id, aluno_id nulo, sem nome). */
    registrarToken(t: TentativaCartao, tokenizationId: string, nome: string): Promise<boolean>;
    token(tokenizacaoId: string): Promise<{ tokenization_id: string; status: string; token_code: string | null; token_expiration: string | null; cardholder_name: string | null } | null>;
    aplicarConsulta(tokenizationId: string, consulta: any): Promise<void>;
    marcar(id: string, campos: Record<string, unknown>): Promise<void>;
    /** Reserva atômica para cobrar: só um chamador passa (status processando e motivo != cobrando). */
    travarCobranca(id: string): Promise<boolean>;
    resultado(id: string, status: "recusado" | "expirado" | "desconhecido", motivo: string): Promise<void>;
    liquidar(id: string, a: { tid: string | null; nsu: string | null; autorizacao: string | null; returnCode: string | null; centavos: number; parcelas: number; raw: unknown }): Promise<void>;
  };
  softDescriptor: string;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  tentativasConsultaToken?: number;
};

const idade = (iso: string, agora: number) => agora - Date.parse(iso);

/** Pede o token e, se ativar logo, cobra na mesma requisição. */
export async function iniciarCartaoReal(deps: Deps, t: TentativaCartao, dados: DadosCartao) {
  const tok = await deps.rede.tokenizar(dados);
  if (!tok.ok || !tok.tokenizationId) { await deps.db.resultado(t.id, "recusado", "token_recusado"); return; }
  if (!(await deps.db.registrarToken(t, tok.tokenizationId, dados.nome))) { await deps.db.resultado(t.id, "recusado", "token_registro_falhou"); return; }
  const esperar = deps.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 0; i < (deps.tentativasConsultaToken ?? 4); i++) {
    if (i > 0) await esperar(3000);
    const atual = await deps.db.tentativa(t.id);
    if (!atual || atual.status !== "processando") return;
    const fim = await avancarToken(deps, atual, dados.nome, dados);
    if (fim) return;
  }
}

/** Polling da tela. O nome vem do token guardado. */
export async function acompanharCartaoReal(deps: Deps, t: TentativaCartao) {
  const agora = (deps.agora ?? Date.now)();
  if (t.status === "desconhecido") return conciliar(deps, t, agora);
  if (t.status !== "processando") return;
  if (t.motivo === "cobrando") {
    if (idade(t.updated_at, agora) > PRAZO_COBRANDO_MS) await deps.db.resultado(t.id, "desconhecido", "cobrando_travado");
    return;
  }
  await avancarToken(deps, t, null, null);
}

/** true = terminou (cobrou, recusou ou expirou). */
async function avancarToken(deps: Deps, t: TentativaCartao, nome: string | null, dados: DadosCartao | null): Promise<boolean> {
  const agora = (deps.agora ?? Date.now)();
  if (!t.tokenizacao_id) {
    if (idade(t.created_at, agora) > PRAZO_TOKEN_MS) { await deps.db.resultado(t.id, "expirado", "token_nao_criado"); return true; }
    return false;
  }
  let reg = await deps.db.token(t.tokenizacao_id);
  if (!reg) return false;
  if (reg.status === "pending") {
    if (idade(t.created_at, agora) > PRAZO_TOKEN_MS) { await deps.db.resultado(t.id, "expirado", "token_expirou"); return true; }
    const c = await deps.rede.consultarToken(reg.tokenization_id);
    if (c.erroRede || c.httpStatus >= 300) return false;
    await deps.db.aplicarConsulta(reg.tokenization_id, c.parsed);
    const e = estadoToken(c.parsed);
    if (e === "pendente") return false;
    if (e === "recusado") { await deps.db.resultado(t.id, "recusado", "token_recusado"); return true; }
    const seg = consultaSegura(c.parsed);
    await deps.db.marcar(t.id, { motivo: "token_ativo", bandeira: seg.bandeira, final_cartao: seg.last4 });
    reg = await deps.db.token(t.tokenizacao_id);
    if (!reg) return false;
  }
  if (reg.status === "failed") { await deps.db.resultado(t.id, "recusado", "token_recusado"); return true; }
  if (reg.status !== "active" || !reg.token_code) return false;
  if (idade(t.created_at, agora) > PRAZO_COBRAR_MS) { await deps.db.resultado(t.id, "expirado", "cliente_ausente"); return true; }
  nome = nome ?? reg.cardholder_name;
  if (!nome) { await deps.db.resultado(t.id, "recusado", "sem_titular"); return true; }
  const val = dados ? { mes: dados.mes, ano: dados.ano } : validadeToken(reg.token_expiration);
  if (!val) { await deps.db.resultado(t.id, "recusado", "validade_ilegivel"); return true; }
  if (!(await deps.db.travarCobranca(t.id))) return true; // outra requisição já está cobrando
  const r = await deps.rede.cobrar({
    tokenizationId: reg.tokenization_id, tokenCode: reg.token_code, mes: val.mes, ano: val.ano, nome,
    centavos: t.valor_centavos, parcelas: t.parcelas, reference: referencia(t.id), softDescriptor: deps.softDescriptor,
  });
  if (r.etapa === "criptograma") { await deps.db.resultado(t.id, "recusado", "criptograma"); return true; }
  const res = mapearTransacao({ erroRede: r.erroRede, httpStatus: r.httpStatus, returnCode: r.parsed?.returnCode ?? null });
  if (res === "aprovado") {
    await deps.db.liquidar(t.id, {
      tid: r.parsed?.tid ?? null, nsu: r.parsed?.nsu ?? null, autorizacao: r.parsed?.authorizationCode ?? null,
      returnCode: r.parsed?.returnCode ?? null, centavos: t.valor_centavos, parcelas: t.parcelas, raw: sanitizarRaw(r.parsed),
    });
  } else if (res === "recusado") await deps.db.resultado(t.id, "recusado", "transacao_" + String(r.parsed?.returnCode ?? "").slice(0, 8));
  else await deps.db.resultado(t.id, "desconhecido", "sem_resposta");
  return true;
}

/** Resultado incerto: nunca recobra; consulta pela referência no máximo a cada 30 s. */
async function conciliar(deps: Deps, t: TentativaCartao, agora: number) {
  if (t.consultado_em && idade(t.consultado_em, agora) < INTERVALO_CONSULTA_MS) return;
  await deps.db.marcar(t.id, { consultado_em: new Date(agora).toISOString() });
  const c = await deps.rede.consultarPorReferencia(referencia(t.id));
  if (c.erroRede) return;
  const m = mapearConsulta(c.httpStatus, c.parsed);
  if (m === "aprovado") {
    const a = c.parsed?.authorization ?? {};
    await deps.db.liquidar(t.id, {
      tid: a.tid ?? null, nsu: a.nsu ?? null, autorizacao: a.authorizationCode ?? null, returnCode: a.returnCode ?? "00",
      centavos: Number(a.amount ?? t.valor_centavos), parcelas: Number(a.installments ?? t.parcelas), raw: sanitizarRaw(a),
    });
  } else if (m === "recusado" || (m === "nao_encontrado" && idade(t.updated_at, agora) > PRAZO_COBRANDO_MS)) {
    await deps.db.resultado(t.id, "recusado", m === "recusado" ? "conciliado_recusado" : "conciliado_nao_encontrado");
  }
}

export { mascararTid };
