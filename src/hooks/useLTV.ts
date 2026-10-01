import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoPagamentoRow {
  id: string;
  aluno_id: string | null;
  cliente_codigo_legado: string | null;
  cliente_nome_legado: string | null;
  ano: number;
  valor_total: number | string | null;
  fonte: string | null;
  alunos: { nome: string | null; status: string | null } | null;
}

export interface ClienteLTV {
  chave: string;
  nome: string;
  alunoId: string | null;
  status: string | null;
  ltv: number;
  anos: number;
  primeiroAno: number;
  ultimoAno: number;
  fontes: string[];
}

export interface CoorteLTV { ano: number; clientes: number; ltvMedio: number; ativos: number; vinculados: number }

export interface LTVData {
  clientes: ClienteLTV[];
  porAno: { ano: number; total: number }[];
  coortes: CoorteLTV[];
  receitaTotal: number;
  ltvMedio: number;
  ticketMedioAnual: number;
  linhas: number;
}

// Data em que o sistema atual passou a ser a fonte de cobrança real,
// substituindo o sistema antigo. O histórico legado vai até agosto/2026;
// a partir daqui os pagamentos vêm de `cobrancas` (status 'pago').
const DATA_CORTE_SISTEMA_NOVO = "2026-09-01";

interface CobrancaPagaRow {
  aluno_id: string;
  valor: number | string | null;
  data_pagamento: string;
  alunos: { nome: string | null; status: string | null } | null;
}

async function fetchHistorico(): Promise<HistoricoPagamentoRow[]> {
  const out: HistoricoPagamentoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("historico_pagamentos_clientes")
      .select("id, aluno_id, cliente_codigo_legado, cliente_nome_legado, ano, valor_total, fonte, alunos(nome, status)")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as HistoricoPagamentoRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function fetchCobrancasPagas(): Promise<HistoricoPagamentoRow[]> {
  const out: HistoricoPagamentoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cobrancas")
      .select("aluno_id, valor, data_pagamento, alunos(nome, status)")
      .eq("status", "pago")
      .gte("data_pagamento", DATA_CORTE_SISTEMA_NOVO)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as unknown as CobrancaPagaRow[];
    for (const c of rows) {
      if (!c.aluno_id || !c.data_pagamento) continue;
      out.push({
        id: `cob:${c.aluno_id}:${c.data_pagamento}:${out.length}`,
        aluno_id: c.aluno_id,
        cliente_codigo_legado: null,
        cliente_nome_legado: null,
        ano: new Date(`${c.data_pagamento}T00:00:00`).getFullYear(),
        valor_total: c.valor,
        fonte: "sistema_atual",
        alunos: c.alunos,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function agregarLTV(rows: HistoricoPagamentoRow[]): LTVData {
  const map = new Map<string, ClienteLTV & { anosSet: Set<number>; fontesSet: Set<string> }>();
  const anoMap = new Map<number, number>();
  let receitaTotal = 0;
  for (const r of rows) {
    const v = Number(r.valor_total ?? 0) || 0;
    receitaTotal += v;
    anoMap.set(r.ano, (anoMap.get(r.ano) ?? 0) + v);
    const chave = r.aluno_id
      ? `a:${r.aluno_id}`
      : r.cliente_codigo_legado
        ? `c:${r.cliente_codigo_legado}`
        : `n:${(r.cliente_nome_legado ?? "").trim().toLowerCase()}`;
    let c = map.get(chave);
    if (!c) {
      c = {
        chave,
        nome: r.alunos?.nome || r.cliente_nome_legado || "(sem nome)",
        alunoId: r.aluno_id,
        status: r.alunos?.status ?? null,
        ltv: 0, anos: 0, primeiroAno: r.ano, ultimoAno: r.ano, fontes: [],
        anosSet: new Set(), fontesSet: new Set(),
      };
      map.set(chave, c);
    }
    c.ltv += v;
    c.anosSet.add(r.ano);
    if (r.fonte) c.fontesSet.add(r.fonte);
    c.primeiroAno = Math.min(c.primeiroAno, r.ano);
    c.ultimoAno = Math.max(c.ultimoAno, r.ano);
  }
  const clientes: ClienteLTV[] = [...map.values()].map(({ anosSet, fontesSet, ...c }) => ({
    ...c, anos: anosSet.size, fontes: [...fontesSet],
  })).sort((a, b) => b.ltv - a.ltv);

  const coMap = new Map<number, CoorteLTV & { soma: number }>();
  for (const c of clientes) {
    const co = coMap.get(c.primeiroAno) ?? { ano: c.primeiroAno, clientes: 0, ltvMedio: 0, ativos: 0, vinculados: 0, soma: 0 };
    co.clientes++; co.soma += c.ltv;
    if (c.alunoId) co.vinculados++;
    if (c.status === "ativo") co.ativos++;
    coMap.set(c.primeiroAno, co);
  }
  const coortes = [...coMap.values()]
    .map(({ soma, ...co }) => ({ ...co, ltvMedio: co.clientes ? soma / co.clientes : 0 }))
    .sort((a, b) => a.ano - b.ano);

  const anosPresentes = [...anoMap.keys()];
  const anoMin = anosPresentes.length ? Math.min(...anosPresentes) : 2019;
  const anoMax = anosPresentes.length ? Math.max(...anosPresentes) : new Date().getFullYear();
  const porAno: { ano: number; total: number }[] = [];
  for (let a = anoMin; a <= anoMax; a++) porAno.push({ ano: a, total: Math.round((anoMap.get(a) ?? 0) * 100) / 100 });

  return {
    clientes, porAno, coortes, receitaTotal, linhas: rows.length,
    ltvMedio: clientes.length ? receitaTotal / clientes.length : 0,
    ticketMedioAnual: rows.length ? receitaTotal / rows.length : 0,
  };
}

export function useLTV(enabled = true) {
  return useQuery({
    queryKey: ["ltv-historico"],
    queryFn: async () => {
      const [historico, cobrancas] = await Promise.all([fetchHistorico(), fetchCobrancasPagas()]);
      return agregarLTV([...historico, ...cobrancas]);
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}
