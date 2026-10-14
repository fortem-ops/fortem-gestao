// Cobrança mensal automática dos planos 2027. NÃO é o cobrar-recorrencias-diario (legado, congelado).
// Chave de serviço → modo real (só cobra com planos_recorrencia_ativa=true + fn_recorrencia_2027_pode_cobrar='ok').
// Admin verificado → só simulação de uma proposta (resultado escolhido, data escolhida), sem chamar a Rede.
// Sem cron nesta fase. Nunca registra número, CVV, CPF ou nome do titular.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { acessoRede, cobrar, consultarPorReferencia, type Acesso } from "../_shared/planos-cartao-rede.ts";
import { mapearConsulta, mapearTransacao, motivoRecusa, validadeToken } from "../_shared/planos-cartao.ts";
import { executar, executarTesteReal, type DepsRec, type Mensalidade } from "./fluxo.ts";
import { modoCronPermitido, segredoConfere } from "./cron.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const sup = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function ehServico(bearer: string, apikey: string): Promise<boolean> {
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (chave && (bearer === chave || apikey === chave)) return true;
  if (bearer.split(".").length !== 3) return false;
  const { data, error } = await sup.auth.getClaims(bearer);
  return !error && data?.claims?.role === "service_role";
}
// x-cron-secret: segredo dedicado da rotina diária (guardado no cofre do banco; aqui só o hash SHA-256).
// Vale SOMENTE para o modo real normal; nunca para simulação/teste real; nunca registrado em log.
async function ehCron(segredo: string): Promise<boolean> {
  if (!segredo || segredo.length < 32 || segredo.length > 256) return false;
  const { data } = await sup.from("planos_recorrencia_cron_hash").select("sha256").eq("id", 1).maybeSingle();
  if (!data?.sha256) return false;
  return segredoConfere(segredo, data.sha256);
}
async function ehAdmin(bearer: string): Promise<boolean> {
  if (!bearer) return false;
  const { data } = await sup.auth.getUser(bearer);
  if (!data?.user) return false;
  const { data: ok } = await sup.rpc("is_admin", { _user_id: data.user.id });
  return ok === true;
}
async function log(acao: string, mensagem: string, payload: Record<string, unknown> = {}) {
  await sup.from("system_logs").insert({ modulo: "planos-recorrencia", acao, mensagem: mensagem.slice(0, 400), payload });
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sup.rpc(fn, args);
  if (error) throw new Error("falha " + fn);
  return data;
}
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function depsBase(simulacao: boolean): Omit<DepsRec, "devidas" | "incertas" | "cobrar" | "consultar"> {
  return {
    simulacao,
    podeCobrar: async (id) => String(await rpc("fn_recorrencia_2027_pode_cobrar", { p_id: id })),
    reservar: async (id) => {
      const r = await rpc("fn_recorrencia_2027_reservar", { p_id: id });
      return r && r.id ? (r as Mensalidade) : null;
    },
    // Espelha em pagamentos_rede (só cobranças reais, o banco ignora simuladas) e grava o resultado na mesma transação.
    resultado: async (id, res, tid, motivo, hoje, rede) =>
      String(await rpc("fn_recorrencia_2027_resultado_rede", {
        p_id: id, p_resultado: res, p_tid: tid, p_nsu: rede?.nsu ?? null, p_autorizacao: rede?.autorizacao ?? null,
        p_return_code: rede?.returnCode ?? null, p_return_message: rede?.returnMessage ?? null, p_motivo: motivo, p_hoje: hoje,
      })),
    alerta: async (mensagem) => {
      await log("teto_execucao", mensagem);
      const { data: adm } = await sup.from("user_roles").select("user_id").eq("role", "admin").order("user_id").limit(1);
      const criador = adm?.[0]?.user_id;
      if (!criador) return;
      const { data: n } = await sup.from("notificacoes").insert({
        titulo: (simulacao ? "[TESTE] " : "") + "Recorrência 2027: teto da execução atingido",
        descricao: mensagem, categoria: "comercial", prioridade: "alta", tipo: "simples", criado_por: criador,
      }).select("id").single();
      if (!n) return;
      const { data: dest } = await sup.from("user_roles").select("user_id").in("role", ["admin", "coordenador"]);
      const ids = [...new Set((dest ?? []).map((d: any) => d.user_id))];
      if (ids.length) await sup.from("notificacao_destinatarios").insert(ids.map((u) => ({ notificacao_id: n.id, usuario_id: u })));
    },
  };
}

function depsReais(acesso: Acesso | null, softDescriptor: string): DepsRec {
  return {
    ...depsBase(false),
    devidas: async (hoje) => (await rpc("fn_recorrencia_2027_devidas", { p_hoje: hoje, p_limite: 50 })) ?? [],
    incertas: async () => (await rpc("fn_recorrencia_2027_incertas", { p_simulado: false })) ?? [],
    cobrar: async (m) => {
      if (!acesso) return { res: "desconhecido", motivo: "sem_acesso_rede" };
      const { data: t } = await sup.from("rede_tokenizacoes")
        .select("tokenization_id, token_code, token_expiration, cardholder_name, status")
        .eq("id", m.tokenizacao_id).eq("proposta_id", m.proposta_id).is("aluno_id", null).maybeSingle();
      if (!t || t.status !== "active" || !t.token_code) return { res: "recusado", motivo: "token_inativo" };
      if (!t.cardholder_name) return { res: "recusado", motivo: "sem_titular" };
      const val = validadeToken(t.token_expiration);
      if (!val) return { res: "recusado", motivo: "validade_ilegivel" };
      const r = await cobrar(acesso, {
        tokenizationId: t.tokenization_id, tokenCode: t.token_code, mes: val.mes, ano: val.ano, nome: t.cardholder_name,
        centavos: m.valor_centavos, parcelas: 1, reference: m.referencia!, softDescriptor, subscription: true,
      });
      if (r.etapa === "criptograma") return { res: "recusado", motivo: "criptograma" };
      const res = mapearTransacao({ erroRede: r.erroRede, httpStatus: r.httpStatus, returnCode: r.parsed?.returnCode ?? null });
      const rede = { nsu: r.parsed?.nsu ?? null, autorizacao: r.parsed?.authorizationCode ?? null, returnCode: r.parsed?.returnCode ?? null,
        returnMessage: typeof r.parsed?.returnMessage === "string" ? r.parsed.returnMessage : null };
      if (res === "aprovado") return { res, tid: r.parsed?.tid ?? null, rede };
      if (res === "recusado") return { res, tid: r.parsed?.tid ?? null, motivo: motivoRecusa(r.parsed), rede };
      return { res, motivo: "sem_resposta" };
    },
    consultar: async (m) => {
      if (!acesso || !m.referencia) return { res: "desconhecido" };
      const c = await consultarPorReferencia(acesso, m.referencia);
      if (c.erroRede) return { res: "desconhecido" };
      const res = mapearConsulta(c.httpStatus, c.parsed);
      // Valor divergente nunca é dado como pago automaticamente.
      if (res === "aprovado" && Number(c.parsed?.authorization?.amount ?? m.valor_centavos) !== m.valor_centavos) return { res: "desconhecido" };
      const a = c.parsed?.authorization ?? {};
      return { res, tid: a.tid ?? null, rede: { nsu: a.nsu ?? null, autorizacao: a.authorizationCode ?? null, returnCode: a.returnCode ?? null, returnMessage: a.returnMessage ?? null } };
    },
  };
}

const RESULTADOS = ["aprovado", "recusado", "desconhecido"] as const;
const CONCILIACOES = ["aprovado", "recusado", "nao_encontrado"] as const;

function depsSimulacao(propostaId: string, resultado: string, conciliacao: string): DepsRec {
  return {
    ...depsBase(true),
    devidas: async (hoje) => (await rpc("fn_recorrencia_2027_devidas_simulacao", { p_proposta_id: propostaId, p_hoje: hoje })) ?? [],
    incertas: async () => (await rpc("fn_recorrencia_2027_incertas", { p_simulado: true, p_proposta_id: propostaId })) ?? [],
    cobrar: async (m) => resultado === "aprovado" ? { res: "aprovado", tid: "SIM-" + m.referencia }
      : resultado === "recusado" ? { res: "recusado", motivo: "simulado_recusado" } : { res: "desconhecido", motivo: "simulado_sem_resposta" },
    consultar: async (m) => ({ res: conciliacao as any, tid: conciliacao === "aprovado" ? "SIM-" + m.referencia : null }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const cronSecret = req.headers.get("x-cron-secret");
  const body = await req.json().catch(() => ({}));
  if (cronSecret !== null) {
    // Caminho exclusivo do cron: só modo real normal.
    if (!(await ehCron(cronSecret))) return json(401, { ok: false });
    if (!modoCronPermitido(body)) return json(403, { ok: false, erro: "cron só executa o modo real" });
    return await modoReal();
  }
  const servico = await ehServico(bearer, req.headers.get("apikey") ?? "");
  const admin = !servico && (await ehAdmin(bearer));
  if (!servico && !admin) return json(401, { ok: false });

  try {
    if (body?.modo === "simulacao") {
      const pid = typeof body.proposta_id === "string" && UUID.test(body.proposta_id) ? body.proposta_id : "";
      const hoje = typeof body.hoje === "string" && DATA.test(body.hoje) ? body.hoje : hojeSP();
      const resultado = RESULTADOS.includes(body.resultado) ? body.resultado : "aprovado";
      const conciliacao = CONCILIACOES.includes(body.conciliacao) ? body.conciliacao : "nao_encontrado";
      if (!pid) return json(400, { ok: false, erro: "proposta_id obrigatório" });
      const resumo = await executar(depsSimulacao(pid, resultado, conciliacao), hoje);
      await log("simulacao", `simulação ${hoje}`, { proposta_id: pid, resultado, ...resumo });
      return json(200, { ok: true, modo: "simulacao", hoje, resumo });
    }
    // Teste real R5 (admin): uma mensalidade da proposta de teste do NICOLAS TESTE; travas no banco.
    if (body?.modo === "teste_real") {
      const pid = typeof body.proposta_id === "string" && UUID.test(body.proposta_id) ? body.proposta_id : "";
      if (!pid) return json(400, { ok: false, erro: "proposta_id obrigatório" });
      const hoje = hojeSP();
      const acesso = await acessoRede();
      if (!acesso) return json(200, { ok: false, motivo: "sem_acesso_rede" }); // antes de reservar: nada consumido
      const { data: sd } = await sup.from("sistema_config").select("valor").eq("chave", "planos_cartao_soft_descriptor").maybeSingle();
      const soft = (typeof sd?.valor === "string" ? sd.valor : "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13);
      const r = await executarTesteReal(depsReais(acesso, soft),
        async () => (await rpc("fn_recorrencia_2027_teste_real_reservar", { p_proposta_id: pid })) as any, hoje);
      await log("teste_real", `teste real: ${r.ok ? r.resultado : r.motivo}`, { proposta_id: pid, ...r });
      return json(200, r);
    }
    // Modo real: chave de serviço (ou o cron, tratado acima).
    if (!servico) return json(403, { ok: false, erro: "admin só executa simulação" });
    return await modoReal();
  } catch (e) {
    await log("erro", String((e as Error)?.message ?? "erro").slice(0, 200));
    return json(500, { ok: false });
  }
});

async function modoReal(): Promise<Response> {
  try {
    const hoje = hojeSP();
    const { data: flag } = await sup.from("sistema_config").select("valor").eq("chave", "planos_recorrencia_ativa").maybeSingle();
    if (String(flag?.valor ?? "false").replace(/"/g, "") !== "true") {
      await log("desligado", "planos_recorrencia_ativa=false; nada cobrado");
      return json(200, { ok: true, modo: "real", desligado: true });
    }
    const { data: sd } = await sup.from("sistema_config").select("valor").eq("chave", "planos_cartao_soft_descriptor").maybeSingle();
    const soft = (typeof sd?.valor === "string" ? sd.valor : "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13);
    const resumo = await executar(depsReais(await acessoRede(), soft), hoje);
    await log("execucao", `execução ${hoje}`, resumo);
    return json(200, { ok: true, modo: "real", hoje, resumo });
  } catch (e) {
    await log("erro", String((e as Error)?.message ?? "erro").slice(0, 200));
    return json(500, { ok: false });
  }
}
