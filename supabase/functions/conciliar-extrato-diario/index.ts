import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { adminAtivo } from "../_shared/admin-ativo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/** Conciliação vale só daqui pra frente: movimentos anteriores a esta data são ignorados. */
const DATA_INICIO_CONCILIACAO = "2026-10-01";
const JANELA_DIAS = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function addDias(d: string, n: number): string {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const JANELA_PENDENTE_DIAS = 3;
/** Palavras genéricas que não identificam beneficiário. */
const STOP = new Set([
  "pix", "enviado", "enviada", "recebido", "pagamento", "pagto", "transferencia", "ted", "doc", "boleto",
  "debito", "credito", "conta", "salario", "ferias", "vale", "transporte", "aluguel", "ltda", "eireli",
  "servicos", "servico", "comercio", "parcela", "referente", "mensal", "fatura", "cartao", "banco", "inter",
]);
export function normTexto(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokensNome(s: string): string[] {
  return normTexto(s).split(" ").filter((t) => t.length >= 4 && !/\d/.test(t) && !STOP.has(t));
}
/** Mesma ideia do casarFuncionario da folha: ao menos um token de nome (4+ letras) em comum. */
export function casaPorNome(movDesc: string, despDesc: string): boolean {
  const tm = new Set(tokensNome(movDesc));
  return tokensNome(despDesc).some((t) => tm.has(t));
}

/** Boleto que vence no fim de semana é debitado no próximo dia útil. */
export function proximoDiaUtil(d: string): string {
  let x = d;
  for (;;) { const w = new Date(`${x}T00:00:00Z`).getUTCDay(); if (w !== 0 && w !== 6) return x; x = addDias(x, 1); }
}
const JANELA_MANUAL_DIAS = 3;
/** Data da despesa (pagamento ou vencimento) compatível com a data do extrato. */
export function dataCompativel(dataDespesa: string | null, dataMov: string): boolean {
  if (!dataDespesa) return false;
  const diff = Math.abs((Date.parse(proximoDiaUtil(dataDespesa)) - Date.parse(dataMov)) / 86400000);
  return diff <= JANELA_MANUAL_DIAS;
}
/** Escolhe a única despesa conciliada à mão (sem vínculo) que bate valor e data; null se nenhuma ou várias. */
export function escolherConciliadaManual(cands: { id: string; valor: number; data_pagamento: string | null; data_competencia: string | null }[], m: { valor: number; data_entrada: string }, usados: Set<string>): string | null | "multiplos" {
  const v = Math.round(Number(m.valor) * 100) / 100;
  const ok = cands.filter((d) => !usados.has(d.id) && Math.abs(Number(d.valor) - v) < 0.005 &&
    (dataCompativel(d.data_pagamento, m.data_entrada) || dataCompativel(d.data_competencia, m.data_entrada)));
  if (ok.length > 1) return "multiplos";
  return ok[0]?.id ?? null;
}

async function vincularConciliadaManual(sb: any, m: any, registrosUsados: Set<string>): Promise<ResultadoPendente> {
  const valor = Math.round(Number(m.valor) * 100) / 100;
  const ini = addDias(m.data_entrada, -7), fim = addDias(m.data_entrada, 7);
  const { data, error } = await sb.from("despesas")
    .select("id, valor, data_pagamento, data_competencia")
    .eq("conciliado", true).eq("conta_bancaria", "BANCO INTER").eq("valor", valor)
    .or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_competencia.gte.${ini},data_competencia.lte.${fim})`)
    .limit(20);
  if (error) { console.error("conciliadas manuais", error.message); return "erro"; }
  const id = escolherConciliadaManual(data ?? [], m, registrosUsados);
  if (id === "multiplos") return "multiplos";
  if (!id) return "nenhum";
  const d = (data ?? []).find((x: any) => x.id === id);
  const { error: insErr } = await sb.from("conciliacoes_bancarias").insert({
    movimento_id: m.id, tabela_origem: "despesas", registro_id: id, tipo_match: "automatico",
    confianca: d?.data_pagamento === m.data_entrada ? "exata" : "aproximada",
  });
  if (insErr) { console.error("vínculo conciliada manual", insErr.message); return "erro"; }
  await sb.from("conciliacao_avisos").update({ resolvido_em: new Date().toISOString() }).eq("movimento_id", m.id).is("resolvido_em", null);
  registrosUsados.add(id);
  return "baixado";
}

type ResultadoPendente = "baixado" | "multiplos" | "nenhum" | "erro";
let mapeamentosCache: { padrao_pix: string; despesa_descricao: string }[] | null = null;

async function baixarPendente(sb: any, m: any, registrosUsados: Set<string>): Promise<ResultadoPendente> {
  const { data, error } = await sb.from("despesas")
    .select("id, descricao, valor")
    .eq("status", "pendente").eq("conciliado", false).eq("conta_bancaria", "BANCO INTER")
    .gte("data_competencia", addDias(m.data_entrada, -JANELA_PENDENTE_DIAS))
    .lte("data_competencia", addDias(m.data_entrada, JANELA_PENDENTE_DIAS))
    .limit(500);
  if (error) { console.error("pendentes", error.message); return "erro"; }
  const pend = (data ?? []).filter((d: any) => !registrosUsados.has(d.id));
  if (!pend.length) return "nenhum";
  const movTexto = `${m.descricao ?? ""} ${m.titulo ?? ""}`;

  // Camada 1: nome
  let cands = pend.filter((d: any) => casaPorNome(movTexto, d.descricao));
  if (cands.length > 1) return "multiplos";

  // Camada 2: mapeamento manual
  if (!cands.length) {
    if (!mapeamentosCache) {
      const { data: mp, error: e } = await sb.from("mapeamento_beneficiarios_pix")
        .select("padrao_pix, despesa_descricao").eq("ativo", true);
      if (e) { console.error("mapeamento", e.message); return "erro"; }
      mapeamentosCache = mp ?? [];
    }
    const movLow = movTexto.toLowerCase();
    const ids = new Set<string>();
    for (const r of mapeamentosCache!) {
      if (!r.padrao_pix || !r.despesa_descricao || !movLow.includes(r.padrao_pix.toLowerCase())) continue;
      const alvo = r.despesa_descricao.toLowerCase();
      pend.filter((d: any) => (d.descricao ?? "").toLowerCase().includes(alvo)).forEach((d: any) => ids.add(d.id));
    }
    cands = pend.filter((d: any) => ids.has(d.id));
    if (cands.length > 1) return "multiplos";
  }
  if (!cands.length) return "nenhum";

  const d = cands[0];
  const valorBanco = Math.round(Number(m.valor) * 100) / 100;
  const confianca = Math.abs(Number(d.valor) - valorBanco) < 0.005 ? "exata" : "aproximada";
  const { error: insErr } = await sb.from("conciliacoes_bancarias").insert({
    movimento_id: m.id, tabela_origem: "despesas", registro_id: d.id, tipo_match: "automatico", confianca,
  });
  if (insErr) { console.error("insert vínculo pendente", insErr.message); return "erro"; }
  // valor_pago = valor da despesa (o que foi projetado/enviado), não o valor do movimento.
  const { error: upErr } = await sb.from("despesas").update({
    status: "pago", data_pagamento: m.data_entrada, valor_pago: Number(d.valor), conciliado: true,
  }).eq("id", d.id).eq("status", "pendente");
  if (upErr) console.error("baixa pendente", upErr.message);
  registrosUsados.add(d.id);
  return "baixado";
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Um aviso por saída: a chave primária em conciliacao_avisos impede repetir nos dias seguintes. */
async function avisarSaidaSemDespesa(sb: any, m: any): Promise<boolean> {
  const { error: resErr } = await sb.from("conciliacao_avisos").insert({ movimento_id: m.id });
  if (resErr) { if (resErr.code !== "23505") console.error("reservar aviso", resErr.message); return false; }
  const { data: adm } = await sb.from("user_roles").select("user_id").eq("role", "admin").order("user_id").limit(1);
  const criador = adm?.[0]?.user_id;
  if (!criador) return false;
  const desc = [m.titulo, m.descricao].filter(Boolean).join(" · ") || "sem descrição";
  const { data: n, error } = await sb.from("notificacoes").insert({
    titulo: `Saída no Inter sem despesa: ${brl(Number(m.valor))} em ${fmtData(m.data_entrada)}`,
    descricao: `Foi identificada uma saída no Banco Inter que não corresponde a nenhuma despesa lançada.\n\n` +
      `Data: ${fmtData(m.data_entrada)}\nValor: ${brl(Number(m.valor))}\nDescrição no extrato: ${desc}\n\n` +
      `Para conciliar (associar a uma despesa existente ajustando o valor, ou criar uma nova despesa), abra: ` +
      `/financeiro/despesas?mov=${m.id}`,
    categoria: "financeiro", prioridade: "media", tipo: "simples", criado_por: criador,
  }).select("id").single();
  if (error || !n) { console.error("criar aviso", error?.message); return false; }
  await sb.from("conciliacao_avisos").update({ notificacao_id: n.id }).eq("movimento_id", m.id);
  const { data: dest } = await sb.from("user_roles").select("user_id").eq("role", "admin");
  const ids = [...new Set((dest ?? []).map((d: any) => d.user_id))];
  if (ids.length) await sb.from("notificacao_destinatarios").insert(ids.map((u) => ({ notificacao_id: n.id, usuario_id: u })));
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("INTER_EXTRATO_WEBHOOK_SECRET");
  mapeamentosCache = null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const viaSegredo = !!secret && req.headers.get("x-webhook-secret") === secret;
  if (!viaSegredo && !(await adminAtivo(sb, req.headers.get("authorization")))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    // Movimentos desde a data de início
    const movs: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("inter_extrato_movimentos")
        .select("id, data_entrada, tipo_operacao, valor, descricao, titulo")
        .gte("data_entrada", DATA_INICIO_CONCILIACAO)
        .order("data_entrada").order("id").range(from, from + 999);
      if (error) throw error;
      movs.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    // Vínculos ativos
    const vinculados = new Set<string>();
    const registrosUsados = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("conciliacoes_bancarias")
        .select("movimento_id, registro_id").eq("desfeito", false).range(from, from + 999);
      if (error) throw error;
      (data ?? []).forEach((r) => { vinculados.add(r.movimento_id); registrosUsados.add(r.registro_id); });
      if (!data || data.length < 1000) break;
    }

    const pendentesMov = movs.filter((m) => !vinculados.has(m.id));
    const resumo = { processados: 0, conciliados: 0, exatas: 0, aproximadas: 0, baixados_automaticamente: 0, pendentes_sem_candidato: 0, pendentes_multiplos: 0, erros: 0, avisos_criados: 0, vinculados_manuais: 0 };

    for (const m of pendentesMov) {
      if (m.tipo_operacao !== "C" && m.tipo_operacao !== "D") continue;
      resumo.processados++;
      const tabela = m.tipo_operacao === "C" ? "receitas" : "despesas";
      const campoData = tabela === "receitas" ? "data_recebimento" : "data_pagamento";
      const valor = Math.round(Number(m.valor) * 100) / 100;

      const { data: cands, error } = await sb.from(tabela)
        .select(`id, ${campoData}`)
        .eq("conta_bancaria", "BANCO INTER")
        .eq("conciliado", false)
        .eq("valor", valor)
        .gte(campoData, addDias(m.data_entrada, -JANELA_DIAS))
        .lte(campoData, addDias(m.data_entrada, JANELA_DIAS))
        .limit(5);
      if (error) { console.error("busca candidatos", tabela, error.message); resumo.erros++; continue; }
      const lista = (cands ?? []).filter((c: any) => !registrosUsados.has(c.id));

      if (lista.length > 1) { resumo.pendentes_multiplos++; continue; }
      if (lista.length === 0) {
        // Camada nova: baixa automática de despesas PENDENTES (só saídas).
        if (tabela !== "despesas") { resumo.pendentes_sem_candidato++; continue; }
        const r = await baixarPendente(sb, m, registrosUsados);
        if (r === "baixado") { resumo.baixados_automaticamente++; continue; }
        if (r === "multiplos") { resumo.pendentes_multiplos++; continue; }
        if (r === "erro") { resumo.erros++; continue; }
        const r2 = await vincularConciliadaManual(sb, m, registrosUsados);
        if (r2 === "baixado") { resumo.vinculados_manuais++; continue; }
        if (r2 === "erro") { resumo.erros++; continue; }
        resumo.pendentes_sem_candidato++;
        if (await avisarSaidaSemDespesa(sb, m)) resumo.avisos_criados++;
        continue;
      }

      const c: any = lista[0];
      const confianca = c[campoData] === m.data_entrada ? "exata" : "aproximada";
      const { error: insErr } = await sb.from("conciliacoes_bancarias").insert({
        movimento_id: m.id, tabela_origem: tabela, registro_id: c.id, tipo_match: "automatico", confianca,
      });
      if (insErr) { console.error("insert vínculo", insErr.message); resumo.erros++; continue; }
      const { error: upErr } = await sb.from(tabela).update({ conciliado: true }).eq("id", c.id);
      if (upErr) console.error("marcar conciliado", upErr.message);
      registrosUsados.add(c.id);
      resumo.conciliados++;
      confianca === "exata" ? resumo.exatas++ : resumo.aproximadas++;
    }

    return json({ ok: true, desde: DATA_INICIO_CONCILIACAO, ...resumo });
  } catch (e) {
    console.error("conciliar-extrato-diario", e instanceof Error ? e.message : e);
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
