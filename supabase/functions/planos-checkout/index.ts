// Checkout público /planos 2027 (Fase 2: identificação → revisão → contrato com aceite).
// Anônimo só fala com esta função; ela chama fn_checkout_2027_* com service_role.
// Nunca registra CPF, e-mail ou telefone; logs só com id da proposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pagamentoReservado } from "../_shared/checkout-pagamento-reservado.ts";
import { interCobFetch } from "../_shared/inter-cob.ts";
import { genTxid } from "../_shared/inter.ts";
import { lerDadosCartao } from "./cartao.ts";
import { acessoRede } from "./cartao-rede.ts";
import { depsReais } from "./deps-cartao.ts";
import { acompanharCartaoReal, iniciarCartaoReal } from "./fluxo-cartao.ts";
import { ACOES_COBRANCA, chavesLimite, cobrancaValida, temConsultas, gravarComRetentativa, PIX_EXPIRACAO_S, resultadoCartaoSimulado, resultadoPixSimulado, statusInterParaTentativa, tentativaPublica, type Tentativa } from "./pagamento.ts";
import {
  cpfDigitosValidos, hashTexto, montarVariaveisContrato, preencherContrato, semCpf, variaveisParaGuardar,
  type Contratante,
} from "../_shared/checkout-2027.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAVE = /^[0-9a-f]{64}$/i;

// Mensagens que as funções do banco podem devolver ao cliente; qualquer outra vira genérica.
const NEUTRAS = [
  "Sessão inválida. Recomece a compra", "Checkout indisponível no momento", "Muitas tentativas. Tente novamente mais tarde",
  "Pagamento em andamento", "Plano indisponível. Revise sua escolha", "Acompanhamento indisponível. Revise sua escolha",
  "Forma de pagamento inválida", "Plano em até 12x", "Grupo de corrida indisponível", "Contrato indisponível para esta escolha",
  "Contrato indisponível no momento", "CPF inválido. Confira os números", "Informe uma data de nascimento válida",
  "Informe um CEP válido", "Preencha o endereço completo", "Este CPF não confere com o seu cadastro",
  "Este CPF precisa ser confirmado. Volte e identifique-se como aluno", "Preencha seus dados antes de aceitar",
  "Marque que você leu e aceita o contrato", "O contrato mudou. Leia a versão atual e aceite de novo",
  "Informe seu nome completo", "Informe um e-mail válido", "Pagamento por cartão indisponível no momento",
  "Pix indisponível no momento", "Confira os dados do cartão",
];
class Neutro extends Error {}

async function softDescriptor(): Promise<string> {
  const { data } = await admin.from("sistema_config").select("valor").eq("chave", "planos_cartao_soft_descriptor").maybeSingle();
  const v = typeof data?.valor === "string" ? data.valor : "";
  return v.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13);
}

async function rpc(nome: string, args: Record<string, unknown>, propostaId: string) {
  const { data, error } = await admin.rpc(nome, args);
  if (error) {
    const msg = NEUTRAS.find((m) => error.message?.includes(m));
    if (msg) throw new Neutro(msg);
    console.error("[planos-checkout] erro", { proposta: propostaId, fn: nome, msg: semCpf(error.message ?? "").slice(0, 200) });
    throw new Error("falha");
  }
  return data;
}

function lerContratante(c: any): Omit<Contratante, "nome" | "email"> & { nome: string; email: string } {
  const s = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const cpf = s(c?.cpf, 20).replace(/\D/g, "");
  if (!cpfDigitosValidos(cpf)) throw new Neutro("CPF inválido. Confira os números");
  return {
    nome: s(c?.nome), email: s(c?.email, 160),
    cpf, data_nascimento: s(c?.data_nascimento, 10), cep: s(c?.cep, 10).replace(/\D/g, ""),
    logradouro: s(c?.logradouro), numero: s(c?.numero, 20), complemento: s(c?.complemento, 80) || null,
    bairro: s(c?.bairro), cidade: s(c?.cidade, 80), uf: s(c?.uf, 2).toUpperCase(), rg: s(c?.rg, 20) || null,
  };
}

/** Parcelas escolhidas na tela de pagamento: inteiro 1..12; qualquer outra coisa vira nulo e o banco decide. */
function lerParcelas(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 12) return null;
  return v;
}


/** Gera o texto do contrato inteiramente no servidor. */
async function gerar(propostaId: string, chave: string, contratante: any, ip: string) {
  const dados = lerContratante(contratante);
  const r = await rpc("fn_checkout_2027_contrato_gerar",
    { p_proposta_id: propostaId, p_chave: chave, p: dados, p_ip: ip }, propostaId);
  if (r?.erro) throw new Neutro(NEUTRAS.find((m) => m === r.erro) ?? "Não foi possível continuar agora");
  const { data: servicos } = await admin.from("servicos_catalogo").select("nome, valor").eq("versao", r.item.versao);
  const vars = montarVariaveisContrato({
    contratante: r.contratante as Contratante, templateNome: r.template.nome,
    totalCentavos: Number(r.calculo.total_centavos), item: r.item, servicos: servicos ?? [],
  });
  const html = preencherContrato(r.template.conteudo, vars);
  return { r, vars, html, hash: await hashTexto(html) };
}

/** Pix real (só modo real_baixo_valor de teste ou checkout ativo). Sem devedor: nenhum CPF sai do servidor. */
/** Expira (só desta proposta) a cobrança ativa vencida/órfã e as tentativas Pix pendentes antigas. A baixa tardia pelo webhook segue valendo. */
async function expirarPixAntigo(propostaId: string, cobId: string | null, tentativaAtual: string | null) {
  if (cobId) await admin.from("pix_cobrancas").update({ status: "EXPIRADA", updated_at: new Date().toISOString() })
    .eq("id", cobId).eq("proposta_id", propostaId).is("pedido_id", null).is("corrida_venda_id", null).in("status", ["CRIADA", "ATIVA"]);
  let q = admin.from("checkout_2027_tentativas").update({ status: "expirado", updated_at: new Date().toISOString() })
    .eq("proposta_id", propostaId).eq("tipo", "pix").eq("status", "pendente");
  if (tentativaAtual) q = q.neq("id", tentativaAtual);
  await q;
}

/** Pix real (só modo real_baixo_valor de teste ou checkout ativo). Sem devedor: nenhum CPF sai do servidor. */
async function pixReal(propostaId: string, t: Tentativa) {
  const { data: existente } = await admin.from("pix_cobrancas").select("id, txid, status, created_at, raw_response")
    .eq("proposta_id", propostaId).in("status", ["CRIADA", "ATIVA"]).maybeSingle();
  // Reaproveita só a cobrança da própria tentativa, ativa e dentro da validade.
  const { data: atual } = await admin.from("checkout_2027_tentativas").select("ref").eq("id", t.id).maybeSingle();
  if (existente?.txid && atual?.ref === existente.txid && cobrancaValida(existente as any))
    return { tentativa: tentativaPublica(t), pix_copia_cola: (existente.raw_response as any)?.pixCopiaECola ?? null };
  if (existente?.id) await expirarPixAntigo(propostaId, existente.id, t.id);
  else await expirarPixAntigo(propostaId, null, t.id);
  const chavePix = Deno.env.get("INTER_PIX_CHAVE");
  if (!chavePix) throw new Neutro("Pix indisponível no momento");
  const txid = genTxid();
  const { status, data } = await interCobFetch(`/pix/v2/cob/${txid}`, {
    method: "PUT",
    json: { calendario: { expiracao: PIX_EXPIRACAO_S }, valor: { original: (t.valor_centavos / 100).toFixed(2) }, chave: chavePix, solicitacaoPagador: "Plano FORTEM" },
  });
  const copia = (data as any)?.pixCopiaECola;
  if (status >= 300 || !copia) {
    console.error("[planos-checkout] Inter /cob falhou", { proposta: propostaId, status });
    await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "recusado", p_ref: null, p_motivo: "falha_criar_pix" }, propostaId);
    throw new Neutro("Pix indisponível no momento");
  }
  const gravou = await gravarComRetentativa(() => admin.from("pix_cobrancas").insert({ proposta_id: propostaId, txid, valor: t.valor_centavos / 100, status: (data as any)?.status ?? "ATIVA", descricao: "Plano FORTEM (site)", raw_response: data }));
  if (!gravou) {
    await avisarRegistroFalhou(propostaId, txid);
    await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "recusado", p_ref: txid, p_motivo: "pix_registro_falhou" }, propostaId);
    throw new Neutro("Pix indisponível no momento");
  }
  await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "pendente", p_ref: txid, p_motivo: null }, propostaId);
  return { tentativa: tentativaPublica(t), pix_copia_cola: copia };
}

/** Pix criado no Inter sem registro local: log + aviso aos admins (sem CPF). O código não é mostrado ao visitante. */
async function avisarRegistroFalhou(propostaId: string, txid: string) {
  try {
    await admin.from("system_logs").insert({ modulo: "planos-checkout", acao: "pix_registro_falhou", mensagem: `proposta ${propostaId} txid ${txid}`, payload: { proposta_id: propostaId, txid } });
  } catch { /* segue para o aviso */ }
  try {
    const { data: p } = await admin.from("propostas_planos_2027").select("nome").eq("id", propostaId).maybeSingle();
    const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    if (!ids.length) return;
    const { data: n } = await admin.from("notificacoes").insert({
      titulo: `Atenção: Pix criado no Inter sem registro — proposta ${p?.nome ?? propostaId}, txid ${txid}`,
      descricao: `A cobrança foi criada no Inter, mas não foi gravada no sistema. O visitante recebeu "Pix indisponível" e não viu o código. Confira no Inter se houve pagamento (txid ${txid}).`,
      categoria: "financeiro", prioridade: "urgente", tipo: "simples", criado_por: ids[0],
    }).select("id").single();
    if (n?.id) await admin.from("notificacao_destinatarios").insert(ids.map((u) => ({ notificacao_id: n.id, usuario_id: u })));
  } catch (e) { console.error("[planos-checkout] aviso pix_registro_falhou", { proposta: propostaId }); }
}

/** Reserva (lock, 3/30 min) + token + cobrança se o token ativar a tempo. */
async function tokenizarCartao(propostaId: string, chave: string, ip: string, cartao: unknown) {
  const dados = lerDadosCartao(cartao);
  if (!dados) throw new Neutro("Confira os dados do cartão");
  const acesso = await acessoRede();
  if (!acesso) throw new Neutro("Pagamento por cartão indisponível no momento");
  const t = await rpc("fn_checkout_2027_cartao_reservar", { p_proposta_id: propostaId, p_chave: chave, p_ip: ip }, propostaId) as Tentativa;
  if (t.simulado) throw new Neutro("Pagamento por cartão indisponível no momento");
  const deps = depsReais(admin, acesso, await softDescriptor());
  if (!t.em_andamento) {
    const tc = await deps.db.tentativa(t.id);
    if (tc) await iniciarCartaoReal(deps, tc, dados);
  }
  await confirmarSePago(propostaId, deps, t.id);
  const fim = await deps.db.tentativa(t.id);
  return { tentativa: tentativaPublica(fim ? { ...t, status: fim.status as Tentativa["status"], motivo: fim.motivo } : t) };
}

/** Avança a tentativa de cartão real em andamento e devolve a tentativa atual. */
async function statusCartao(propostaId: string, chave: string): Promise<Tentativa | null> {
  const st = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
  const t = st?.tentativa as Tentativa | null;
  if (!t || t.simulado || t.tipo !== "cartao" || !["processando", "desconhecido"].includes(t.status)) return t;
  const acesso = await acessoRede();
  if (!acesso) return t;
  const deps = depsReais(admin, acesso, await softDescriptor());
  const tc = await deps.db.tentativa(t.id);
  if (tc) await acompanharCartaoReal(deps, tc);
  await confirmarSePago(propostaId, deps, t.id);
  const re = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
  return re?.tentativa ?? t;
}

/** 3 tentativas de cartão em 30 min (mesma regra de fn_checkout_2027_pagamento_iniciar), sem nenhuma em andamento. */
async function cartaoEsgotado(propostaId: string): Promise<boolean> {
  const desde = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await admin.from("checkout_2027_tentativas").select("status").eq("proposta_id", propostaId).eq("tipo", "cartao").gt("created_at", desde);
  const l = data ?? [];
  return l.length >= 3 && !l.some((t: any) => ["processando", "desconhecido", "aprovado"].includes(t.status));
}

/** Dispara o e-mail de confirmação; falha nunca desfaz a baixa, mas fica registrada (só id e mensagem curta). */
async function chamarConfirmacao(propostaId: string) {
  let msg = "";
  try {
    const { error } = await admin.functions.invoke("planos-confirmacao", { body: { proposta_id: propostaId } });
    if (error) {
      const status = (error as any)?.context?.status;
      msg = `${error.name ?? "erro"}${status ? ` HTTP ${status}` : ""}`;
    }
  } catch (e) { msg = String((e as Error)?.message ?? e); }
  if (msg) {
    try { await admin.from("system_logs").insert({ modulo: "planos-checkout", acao: "confirmacao_falhou", mensagem: `${propostaId}: ${msg}`.slice(0, 200) }); } catch { /* log best-effort */ }
  }
}

async function confirmarSePago(propostaId: string, deps: ReturnType<typeof depsReais>, id: string) {
  const t = await deps.db.tentativa(id);
  if (t?.status === "aprovado") await chamarConfirmacao(propostaId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 500);
  const body = await req.json().catch(() => ({}));
  const acao = body?.acao;
  const propostaId = typeof body?.proposta_id === "string" && UUID.test(body.proposta_id) ? body.proposta_id : "";
  const chave = typeof body?.chave_sessao === "string" && CHAVE.test(body.chave_sessao) ? body.chave_sessao : "";
  if (!propostaId) return json(200, { erro: "Sessão inválida. Recomece a compra" });

  try {
    // Consultas da tela (polling) têm cota própria por proposta; demais ações seguem 120/h por IP.
    for (const l of chavesLimite(acao, ip, propostaId))
      if (!(await rpc("fn_planos_limite", { p_chave: l.chave, p_limite: l.limite }, propostaId)))
        throw new Neutro("Muitas tentativas. Tente novamente mais tarde");

    if (acao === "iniciar") {
      // Prévia: admin logado marca a proposta como teste. O papel é conferido no servidor.
      let diag: Record<string, unknown> | null = null;
      if (body?.previa === true) {
        const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const ehAnon = !token || token === Deno.env.get("SUPABASE_ANON_KEY");
        diag = { proposta: propostaId, token_recebido: !ehAnon, getuser_ok: false, admin: false, marcou: false, erro_marcacao: null };
        let uid: string | null = null;
        if (!ehAnon) {
          const { data: u } = await admin.auth.getUser(token);
          uid = u?.user?.id ?? null;
          diag.getuser_ok = !!uid;
        }
        if (uid) {
          const { data: adm } = await admin.rpc("is_admin", { _user_id: uid });
          diag.admin = adm === true;
          if (adm === true) {
            const { data: m, error: em } = await admin.rpc("fn_checkout_2027_marcar_teste_admin", { p_proposta_id: propostaId, p_user_id: uid });
            diag.marcou = m === true;
            if (em) diag.erro_marcacao = (em.message ?? "").slice(0, 200);
          }
        }
        await admin.from("system_logs").insert({ modulo: "planos-checkout", acao: "diagnostico_previa", mensagem: diag.marcou ? "marcada" : "não marcada", payload: diag, user_id: uid });
      }
      try {
        return json(200, await rpc("fn_checkout_2027_iniciar", { p_proposta_id: propostaId }, propostaId));
      } catch (e) {
        if (diag && e instanceof Neutro) {
          const motivo = !diag.token_recebido ? "sessão de admin não enviada" : !diag.getuser_ok ? "sessão de admin não aceita" : !diag.admin ? "conta sem papel de admin" : !diag.marcou ? "proposta não pôde ser marcada como teste" : "outro motivo";
          return json(200, { erro: e.message, diagnostico: motivo });
        }
        throw e;
      }
    }
    if (!chave) return json(200, { erro: "Sessão inválida. Recomece a compra" });

    if (acao === "estado") {
      return json(200, await rpc("fn_checkout_2027_estado", { p_proposta_id: propostaId, p_chave: chave }, propostaId));
    }
    if (acao === "revisar") {
      return json(200, await rpc("fn_checkout_2027_revisar", { p_proposta_id: propostaId, p_chave: chave, p_ip: ip }, propostaId));
    }
    if (acao === "tela_pagamento") {
      // Session/eligibility and acceptance are validated on the server.
      // No payment, card storage, Pix generation or financial status write.
      const e = await rpc("fn_checkout_2027_estado", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
      if (!["contrato_aceito", "aguardando_pagamento", "falhou"].includes(e.etapa) || !e.aceite_id) throw new Neutro("O contrato mudou. Leia a versão atual e aceite de novo");
      const r = await rpc("fn_checkout_2027_calcular", { p_proposta_id: propostaId }, propostaId);
      if (Object.keys(r).some((k) => JSON.stringify(r[k]) !== JSON.stringify(e.revisao?.[k])))
        throw new Neutro("O contrato mudou. Leia a versão atual e aceite de novo");
      const sim = await rpc("fn_checkout_2027_cartao_simulado", { p_proposta_id: propostaId }, propostaId);
      const real = (await rpc("fn_checkout_2027_cartao_real", { p_proposta_id: propostaId }, propostaId)) === true;
      return json(200, { revisao: { ...r, etapa: e.etapa }, pagamento: { ...pagamentoReservado(r, sim === true || real), cartao_real: real, cartao_simulado: sim === true && !real }, aceite_id: e.aceite_id });
    }
    if (ACOES_COBRANCA.has(acao)) {
      // O site vende só o plano: proposta antiga com consultas nunca segue para cobrança.
      const { data: pc } = await admin.from("propostas_planos_2027").select("servicos_codigos").eq("id", propostaId).maybeSingle();
      if (temConsultas(pc?.servicos_codigos)) throw new Neutro("Consultas são contratadas com a equipe. Fale conosco pelo WhatsApp");
    }
    if (acao === "cartao_combinar") {
      // Cartão real não ligado: sem tentativa e sem "falhou"; avisa a equipe uma vez por proposta.
      const res = await rpc("fn_checkout_2027_cartao_combinar", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
      return json(200, { ok: res?.ok === true });
    }
    if (acao === "pagar_pix") {
      const t = await rpc("fn_checkout_2027_pagamento_iniciar", { p_proposta_id: propostaId, p_chave: chave, p_tipo: "pix", p_ip: ip }, propostaId) as Tentativa;
      if (t.simulado) return json(200, { tentativa: tentativaPublica(t), pix_copia_cola: null });
      return json(200, await pixReal(propostaId, t));
    }
    if (acao === "tokenizar_cartao" || acao === "pagar_cartao") {
      // Real só com fn_checkout_2027_cartao_real (flag + modo + elegibilidade, conferidos no banco).
      // Cartão real já em andamento (mesmo após o modo de teste voltar a simulação): só acompanha, nunca cria outra.
      const andamento = await statusCartao(propostaId, chave);
      if (andamento && !andamento.simulado && andamento.tipo === "cartao" && ["processando", "desconhecido"].includes(andamento.status))
        return json(200, { tentativa: tentativaPublica(andamento) });
      const real = (await rpc("fn_checkout_2027_cartao_real", { p_proposta_id: propostaId }, propostaId)) === true;
      if (await cartaoEsgotado(propostaId)) return json(200, { tentativa: tentativaPublica(andamento), cartao_esgotado: true });
      if (real) return json(200, { ...(await tokenizarCartao(propostaId, chave, ip, body?.cartao)), cartao_esgotado: await cartaoEsgotado(propostaId) });
      if (acao === "tokenizar_cartao") throw new Neutro("Pagamento por cartão indisponível no momento");
      // pagar_cartao em simulação: igual a antes, nunca chama a Rede.
      if ((await rpc("fn_checkout_2027_cartao_simulado", { p_proposta_id: propostaId }, propostaId)) !== true)
        throw new Neutro("Pagamento por cartão indisponível no momento");
      const t = await rpc("fn_checkout_2027_pagamento_iniciar", { p_proposta_id: propostaId, p_chave: chave, p_tipo: "cartao", p_ip: ip }, propostaId) as Tentativa;
      if (t.simulado) {
        const r = await rpc("fn_checkout_2027_simular_resultado", { p_tentativa_id: t.id, p_resultado: resultadoCartaoSimulado(body?.simular) }, propostaId);
        return json(200, { tentativa: tentativaPublica(r), cartao_esgotado: await cartaoEsgotado(propostaId) });
      }
      await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "recusado", p_ref: null, p_motivo: "cartao_real_nao_liberado" }, propostaId);
      throw new Neutro("Pagamento por cartão indisponível no momento");
    }
    if (acao === "status_cartao") {
      return json(200, { tentativa: tentativaPublica(await statusCartao(propostaId, chave)), cartao_esgotado: await cartaoEsgotado(propostaId) });
    }
    if (acao === "simular_pix") {
      const res = resultadoPixSimulado(body?.resultado);
      const st = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
      const t = st?.tentativa as Tentativa | null;
      if (!res || !t || t.tipo !== "pix" || !t.simulado) throw new Neutro("Checkout indisponível no momento");
      const r = await rpc("fn_checkout_2027_simular_resultado", { p_tentativa_id: t.id, p_resultado: res }, propostaId);
      return json(200, { tentativa: tentativaPublica(r) });
    }
    if (acao === "status_pagamento") {
      const st = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
      let t = st?.tentativa as Tentativa | null;
      // Pix real: o banco (baixa pelo webhook) vem primeiro. Consulta GET no Inter só como reserva, no máximo a cada 30 s.
      if (t && !t.simulado && t.tipo === "pix" && t.status === "pendente" && typeof st.ref === "string") {
        const limite = new Date(Date.now() - 30_000).toISOString();
        const { data: tocado } = await admin.from("pix_cobrancas").update({ updated_at: new Date().toISOString() })
          .eq("proposta_id", propostaId).eq("txid", st.ref).lt("updated_at", limite).select("id");
        if (tocado?.length) {
          const { status, data } = await interCobFetch(`/pix/v2/cob/${st.ref}`, { method: "GET" });
          const novo = status < 300 ? statusInterParaTentativa((data as any)?.status) : null;
          if (novo === "aprovado") {
            const valor = Math.round(Number((data as any)?.valor?.original ?? 0) * 100);
            const { data: bx } = await admin.rpc("fn_checkout_2027_pix_liquidado", { p_txid: st.ref, p_valor_centavos: valor, p_e2e: (data as any)?.pix?.[0]?.endToEndId ?? null, p_raw: null });
            if (bx?.resultado === "baixado" || bx?.resultado === "ja_processado") {
              await chamarConfirmacao(propostaId);
            }
            const re = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
            t = re?.tentativa ?? t;
          } else if (novo) t = await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: novo, p_ref: null, p_motivo: null }, propostaId);
        }
      }
      // Cartão real em andamento: avança token/cobrança/conciliação (nunca recobra "desconhecido").
      if (t && !t.simulado && t.tipo === "cartao" && (t.status === "processando" || t.status === "desconhecido"))
        t = (await statusCartao(propostaId, chave)) ?? t;
      let copia: string | null = null;
      // Só avalia vencimento depois que a cobrança foi gravada (ref preenchida); durante a criação não mexe.
      if (t && !t.simulado && t.tipo === "pix" && t.status === "pendente" && typeof st.ref === "string") {
        const { data: c } = await admin.from("pix_cobrancas").select("id, txid, status, created_at, raw_response").eq("proposta_id", propostaId).in("status", ["CRIADA", "ATIVA"]).maybeSingle();
        const venceu = (t.expira_em && Date.parse(t.expira_em) <= Date.now()) || !c || c.txid !== st.ref || !cobrancaValida(c as any);
        if (venceu) {
          // Vencido: expira cobrança e tentativa desta proposta; aviso tardio do Inter ainda dá baixa pelo txid.
          if (c?.id && c.txid === st.ref) await expirarPixAntigo(propostaId, c.id, null);
          t = await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "expirado", p_ref: null, p_motivo: "pix_vencido" }, propostaId);
        } else copia = (c?.raw_response as any)?.pixCopiaECola ?? null;
      }
      // Tentativa já expirada pelo banco: a cobrança ativa dela também vira EXPIRADA (só desta proposta).
      if (t && !t.simulado && t.tipo === "pix" && t.status === "expirado" && typeof st.ref === "string") {
        const { data: c } = await admin.from("pix_cobrancas").select("id, status, created_at").eq("proposta_id", propostaId).eq("txid", st.ref).in("status", ["CRIADA", "ATIVA"]).maybeSingle();
        if (c?.id) await expirarPixAntigo(propostaId, c.id, null);
      }
      return json(200, { etapa: st?.etapa, tentativa: tentativaPublica(t), pix_copia_cola: copia, cartao_esgotado: t?.tipo === "cartao" ? await cartaoEsgotado(propostaId) : false });
    }
    if (acao === "alterar") {
      const e = body?.escolhas ?? {};
      const escolhas = {
        plano_codigo: String(e.plano_codigo ?? "").slice(0, 60), forma_plano: String(e.forma_plano ?? "").slice(0, 30),
        parcelas_plano: Number(e.parcelas_plano) || 1,
        servicos: Array.isArray(e.servicos) ? e.servicos.filter((x: unknown) => typeof x === "string").slice(0, 4) : [],
        forma_servicos: typeof e.forma_servicos === "string" ? e.forma_servicos.slice(0, 30) : null,
        parcelas_servicos: Number(e.parcelas_servicos) || 1, corrida: e.corrida === true,
        corrida_periodo_meses: Number(e.corrida_periodo_meses) || 1,
      };
      return json(200, await rpc("fn_checkout_2027_alterar", { p_proposta_id: propostaId, p_chave: chave, p: escolhas, p_ip: ip }, propostaId));
    }
    if (acao === "dados_contratante") {
      // Só devolve dados do cadastro quando o vínculo foi confirmado por código; nunca o CPF completo.
      const r = await rpc("fn_checkout_2027_dados_contratante", { p_proposta_id: propostaId, p_chave: chave, p_ip: ip }, propostaId);
      const dica = typeof r?.cpf_ultimos3 === "string" && /^\d{3}$/.test(r.cpf_ultimos3) ? `***.***.**${r.cpf_ultimos3[0]}-${r.cpf_ultimos3.slice(1)}` : null;
      const { cpf_ultimos3: _x, ...resto } = r ?? {};
      return json(200, { ...resto, cpf_dica: r?.confirmado ? dica : null });
    }
    if (acao === "gerar_contrato") {
      const g = await gerar(propostaId, chave, body?.contratante, ip);
      return json(200, {
        template_id: g.r.template.id, template_versao: g.r.template.versao, conteudo_html: g.html, hash: g.hash,
        calculo: g.r.calculo,
      });
    }
    if (acao === "aceitar") {
      // O texto é gerado de novo no servidor; o hash enviado pelo navegador tem que ser o mesmo.
      const g = await gerar(propostaId, chave, body?.contratante, ip);
      const exibido = typeof body?.hash_exibido === "string" ? body.hash_exibido : "";
      if (exibido !== g.hash) throw new Neutro("O contrato mudou. Leia a versão atual e aceite de novo");
      const res = await rpc("fn_checkout_2027_aceitar", {
        p_proposta_id: propostaId, p_chave: chave, p_ip: ip, p_user_agent: ua,
        p: {
          li_e_aceito: body?.li_e_aceito === true, hash_exibido: exibido, conteudo_html: g.html,
          template_id: g.r.template.id, template_versao: g.r.template.versao, variaveis: variaveisParaGuardar(g.vars),
        },
      }, propostaId);
      return json(200, res);
    }
    return json(400, { error: "acao_invalida" });
  } catch (e) {
    // Recusa esperada (neutra): 200 com "erro", para o navegador tratar sem acusar falha da função.
    if (e instanceof Neutro) return json(200, { erro: e.message });
    return json(500, { error: "Não foi possível continuar agora. Tente novamente em instantes" });
  }
});
