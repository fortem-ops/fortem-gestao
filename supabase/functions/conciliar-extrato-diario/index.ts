import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("INTER_EXTRATO_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ ok: false, error: "unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Movimentos desde a data de início
    const movs: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("inter_extrato_movimentos")
        .select("id, data_entrada, tipo_operacao, valor")
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
    const resumo = { processados: 0, conciliados: 0, exatas: 0, aproximadas: 0, pendentes_sem_candidato: 0, pendentes_multiplos: 0, erros: 0 };

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

      if (lista.length === 0) { resumo.pendentes_sem_candidato++; continue; }
      if (lista.length > 1) { resumo.pendentes_multiplos++; continue; }

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
