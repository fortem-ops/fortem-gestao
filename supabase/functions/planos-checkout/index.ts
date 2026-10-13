// Checkout público /planos 2027 (Fase 2: identificação → revisão → contrato com aceite).
// Anônimo só fala com esta função; ela chama fn_checkout_2027_* com service_role.
// Nunca registra CPF, e-mail ou telefone; logs só com id da proposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pagamentoReservado } from "../_shared/checkout-pagamento-reservado.ts";
import { interCobFetch } from "../_shared/inter-cob.ts";
import { genTxid } from "../_shared/inter.ts";
import { resultadoCartaoSimulado, resultadoPixSimulado, statusInterParaTentativa, tentativaPublica, type Tentativa } from "./pagamento.ts";
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
  "Pix indisponível no momento",
];
class Neutro extends Error {}

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
async function pixReal(propostaId: string, t: Tentativa) {
  const { data: existente } = await admin.from("pix_cobrancas").select("txid, raw_response")
    .eq("proposta_id", propostaId).in("status", ["CRIADA", "ATIVA"]).maybeSingle();
  if (existente?.txid) return { tentativa: tentativaPublica(t), pix_copia_cola: (existente.raw_response as any)?.pixCopiaECola ?? null };
  const chavePix = Deno.env.get("INTER_PIX_CHAVE");
  if (!chavePix) throw new Neutro("Pix indisponível no momento");
  const txid = genTxid();
  const { status, data } = await interCobFetch(`/pix/v2/cob/${txid}`, {
    method: "PUT",
    json: { calendario: { expiracao: 1800 }, valor: { original: (t.valor_centavos / 100).toFixed(2) }, chave: chavePix, solicitacaoPagador: "Plano FORTEM" },
  });
  const copia = (data as any)?.pixCopiaECola;
  if (status >= 300 || !copia) {
    console.error("[planos-checkout] Inter /cob falhou", { proposta: propostaId, status });
    await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "recusado", p_ref: null, p_motivo: "falha_criar_pix" }, propostaId);
    throw new Neutro("Pix indisponível no momento");
  }
  await admin.from("pix_cobrancas").insert({ proposta_id: propostaId, txid, valor: t.valor_centavos / 100, status: (data as any)?.status ?? "ATIVA", descricao: "Plano FORTEM (site)", raw_response: data });
  await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "pendente", p_ref: txid, p_motivo: null }, propostaId);
  return { tentativa: tentativaPublica(t), pix_copia_cola: copia };
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
    if (ip && !(await rpc("fn_planos_limite", { p_chave: `ckf:i:${ip}`, p_limite: 120 }, propostaId)))
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
      return json(200, { revisao: { ...r, etapa: e.etapa }, pagamento: pagamentoReservado(r, sim === true), aceite_id: e.aceite_id });
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
    if (acao === "pagar_cartao") {
      // Fora da simulação o cartão vai para "a combinar": recusa antes de criar tentativa.
      if ((await rpc("fn_checkout_2027_cartao_simulado", { p_proposta_id: propostaId }, propostaId)) !== true)
        throw new Neutro("Pagamento por cartão indisponível no momento");
      const t = await rpc("fn_checkout_2027_pagamento_iniciar", { p_proposta_id: propostaId, p_chave: chave, p_tipo: "cartao", p_ip: ip }, propostaId) as Tentativa;
      if (t.simulado) {
        const r = await rpc("fn_checkout_2027_simular_resultado", { p_tentativa_id: t.id, p_resultado: resultadoCartaoSimulado(body?.simular) }, propostaId);
        return json(200, { tentativa: tentativaPublica(r) });
      }
      // Cobrança real no cartão ainda não está ligada nesta fase: registra recusa sem chamar a Rede.
      await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: "recusado", p_ref: null, p_motivo: "cartao_real_nao_liberado" }, propostaId);
      throw new Neutro("Pagamento por cartão indisponível no momento");
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
              try { await admin.functions.invoke("planos-confirmacao", { body: { proposta_id: propostaId } }); } catch { /* idempotente; registrado lá */ }
            }
            const re = await rpc("fn_checkout_2027_pagamento_status", { p_proposta_id: propostaId, p_chave: chave }, propostaId);
            t = re?.tentativa ?? t;
          } else if (novo) t = await rpc("fn_checkout_2027_tentativa_atualizar", { p_tentativa_id: t.id, p_status: novo, p_ref: null, p_motivo: null }, propostaId);
        }
      }
      let copia: string | null = null;
      if (t && !t.simulado && t.tipo === "pix" && t.status === "pendente") {
        const { data: c } = await admin.from("pix_cobrancas").select("raw_response").eq("proposta_id", propostaId).in("status", ["CRIADA", "ATIVA"]).maybeSingle();
        copia = (c?.raw_response as any)?.pixCopiaECola ?? null;
      }
      return json(200, { etapa: st?.etapa, tentativa: tentativaPublica(t), pix_copia_cola: copia });
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
