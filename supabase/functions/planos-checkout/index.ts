// Checkout público /planos 2027 (Fase 2: identificação → revisão → contrato com aceite).
// Anônimo só fala com esta função; ela chama fn_checkout_2027_* com service_role.
// Nunca registra CPF, e-mail ou telefone; logs só com id da proposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

function lerContratante(c: any): Omit<Contratante, "nome" | "email"> {
  const s = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const cpf = s(c?.cpf, 20).replace(/\D/g, "");
  if (!cpfDigitosValidos(cpf)) throw new Neutro("CPF inválido. Confira os números");
  return {
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
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (body?.previa === true && token) {
        const { data: u } = await admin.auth.getUser(token);
        if (u?.user?.id) {
          await admin.rpc("fn_checkout_2027_marcar_teste_admin", { p_proposta_id: propostaId, p_user_id: u.user.id });
        }
      }
      return json(200, await rpc("fn_checkout_2027_iniciar", { p_proposta_id: propostaId }, propostaId));
    }
    if (!chave) return json(200, { erro: "Sessão inválida. Recomece a compra" });

    if (acao === "estado") {
      return json(200, await rpc("fn_checkout_2027_estado", { p_proposta_id: propostaId, p_chave: chave }, propostaId));
    }
    if (acao === "revisar") {
      return json(200, await rpc("fn_checkout_2027_revisar", { p_proposta_id: propostaId, p_chave: chave, p_ip: ip }, propostaId));
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
