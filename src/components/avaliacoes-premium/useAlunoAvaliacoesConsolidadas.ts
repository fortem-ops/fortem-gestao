import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { carregarTodasAsPaginas } from "@/lib/supabasePaginado";
import type { Tables } from "@/integrations/supabase/types";
import type { ForcaInput, MetricInput, MobilidadeReferenceData, ReferenciaFaixas } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { ALL_FUNCTIONAL_METRICS, criarReferenciaFaixas } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { FAIXAS_ETARIAS, type FaixaEtaria } from "@/lib/faixaEtaria";

export interface ForcaSavedRow {
  nome: ForcaInput["nome"];
  direito_kg: number;
  esquerdo_kg: number;
  assimetria?: number;
  classificacao?: string;
}

export interface ComposicaoSnapshot {
  data: string;
  sexo: "M" | "F";
  idade: number;
  peso: number;
  altura: number;
  bf: number;          // % gordura
  imc: number | null;
  massaMagra: number | null;
  massaGorda: number | null;
  sigma7: number;
  classificacao: string;
  dobras: Record<string, number | string>;
}

export interface FuncionalSnapshot {
  data: string;
  metricas: MetricInput[];
  forca: ForcaSavedRow[];
}

export interface PliometriaSnapshot {
  data: string;
  salto_vertical?: number | null;
  salto_horizontal?: number | null;
  rsi?: number | null;
  tempo_contato?: number | null;
  potencia?: number | null;
  stiffness?: number | null;
  assimetria?: number | null;
  observacoes?: string | null;
}

export interface ConsolidadoAluno {
  aluno: Tables<"alunos"> | null;
  avaliador: { id: string; nome: string | null } | null;
  funcional: { latest: FuncionalSnapshot | null; history: FuncionalSnapshot[] };
  composicao: { latest: ComposicaoSnapshot | null; history: ComposicaoSnapshot[] };
  pliometria: { latest: PliometriaSnapshot | null; history: PliometriaSnapshot[] };
  raw: Tables<"avaliacoes">[];
}

function parseFuncional(row: Tables<"avaliacoes">): FuncionalSnapshot | null {
  const dados = (row.dados as Record<string, unknown>) || {};
  const metricas = (dados.metricas as MetricInput[] | undefined) ?? [];
  const forcaArr =
    ((dados.forca as { exercicios?: ForcaSavedRow[] } | undefined)?.exercicios) ?? [];
  if (metricas.length === 0 && forcaArr.length === 0) return null;
  return { data: row.data, metricas, forca: forcaArr };
}

function parseComposicao(row: Tables<"avaliacoes">): ComposicaoSnapshot | null {
  const d = (row.dados as Record<string, unknown>) || {};
  if (typeof d.percentual_gordura !== "number") return null;
  return {
    data: row.data,
    sexo: (d.sexo as "M" | "F") ?? "M",
    idade: Number(d.idade ?? 0),
    peso: Number(d.peso ?? 0),
    altura: Number(d.altura ?? 0),
    bf: Number(d.percentual_gordura),
    imc: typeof d.imc === "number" ? d.imc : null,
    massaMagra: typeof d.massa_magra === "number" ? d.massa_magra : null,
    massaGorda: typeof d.massa_gorda === "number" ? d.massa_gorda : null,
    sigma7: Number(d.sigma7 ?? 0),
    classificacao: String(d.classificacao ?? ""),
    dobras: (d.dobras as Record<string, number | string>) ?? {},
  };
}

function parsePliometria(row: Tables<"avaliacoes">): PliometriaSnapshot | null {
  const d = (row.dados as Record<string, unknown>) || {};
  // Fonte: dados JSONB (formulário novo grava em dados também por compatibilidade).
  if (!d || Object.keys(d).length === 0) return null;
  return {
    data: row.data,
    salto_vertical: (d.salto_vertical as number) ?? null,
    salto_horizontal: (d.salto_horizontal as number) ?? null,
    rsi: (d.rsi as number) ?? null,
    tempo_contato: (d.tempo_contato as number) ?? null,
    potencia: (d.potencia as number) ?? null,
    stiffness: (d.stiffness as number) ?? null,
    assimetria: (d.assimetria as number) ?? null,
    observacoes: (d.observacoes as string) ?? null,
  };
}

/** Diferença em dias entre duas datas ISO (yyyy-mm-dd). */
function diasEntre(a: string, b: string): number {
  const ms = Math.abs(new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime());
  return Math.round(ms / 86400000);
}

/**
 * Remove cópias de uma mesma avaliação: registros com valores idênticos e datas
 * a até 3 dias de distância. Mantém a linha mais rica (mais dados preenchidos)
 * e, em empate, a mais recente. Espera `history` ordenado da mais recente p/ a mais antiga.
 */
function removerDuplicadas<T extends { data: string }>(
  history: T[],
  chave: (s: T) => string,
  riqueza: (s: T) => number,
): T[] {
  const mantidos: T[] = [];
  for (const atual of history) {
    const k = chave(atual);
    const idx = mantidos.findIndex((m) => chave(m) === k && diasEntre(m.data, atual.data) <= 3);
    if (idx === -1) {
      mantidos.push(atual);
      continue;
    }
    const existente = mantidos[idx];
    const melhor =
      riqueza(atual) > riqueza(existente) ||
      (riqueza(atual) === riqueza(existente) && atual.data > existente.data)
        ? atual
        : existente;
    mantidos[idx] = melhor;
  }
  return mantidos;
}

const chaveFuncional = (s: FuncionalSnapshot) =>
  JSON.stringify(
    [...s.metricas]
      .map((m) => [m.metric, m.left ?? null, m.right ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );

const chaveComposicao = (s: ComposicaoSnapshot) =>
  JSON.stringify([s.bf, s.peso, s.sigma7, s.massaMagra ?? null, s.massaGorda ?? null]);

const chavePliometria = (s: PliometriaSnapshot) =>
  JSON.stringify([
    s.salto_vertical ?? null,
    s.salto_horizontal ?? null,
    s.rsi ?? null,
    s.tempo_contato ?? null,
    s.potencia ?? null,
    s.stiffness ?? null,
    s.assimetria ?? null,
  ]);

const contarPreenchidos = (obj: Record<string, unknown>) =>
  Object.values(obj).filter((v) => v !== null && v !== undefined && v !== "").length;

export function useAlunoAvaliacoesConsolidadas(alunoId: string | null | undefined) {
  return useQuery<ConsolidadoAluno>({
    enabled: !!alunoId,
    queryKey: ["aluno-avaliacoes-consolidadas", alunoId],
    queryFn: async () => {
      const [{ data: aluno }, { data: avaliacoes }] = await Promise.all([
        supabase.from("alunos").select("*").eq("id", alunoId!).maybeSingle(),
        supabase
          .from("avaliacoes")
          .select("*")
          .eq("aluno_id", alunoId!)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      const rows = avaliacoes ?? [];

      // Avaliador da avaliação mais recente
      let avaliador: ConsolidadoAluno["avaliador"] = null;
      const latestAvaliadorId = rows[0]?.avaliador_id ?? null;
      if (latestAvaliadorId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", latestAvaliadorId)
          .maybeSingle();
        avaliador = { id: latestAvaliadorId, nome: prof?.full_name ?? null };
      }

      const funcRows = rows.filter(
        (r) => r.tipo === "funcional" || r.tipo === "kinology" || r.tipo === "funcional_v2",
      );
      const funcHistory = funcRows
        .map(parseFuncional)
        .filter((x): x is FuncionalSnapshot => !!x);
      // Funcional latest = junta a métrica mais recente (mob/flex) com a força mais recente.
      const latestFunc = funcHistory[0] ?? null;
      const latestForca = funcHistory.find((s) => s.forca.length > 0)?.forca ?? [];
      const mergedFunc: FuncionalSnapshot | null = latestFunc
        ? { ...latestFunc, forca: latestFunc.forca.length ? latestFunc.forca : latestForca }
        : null;

      const compRows = rows.filter((r) => r.tipo === "composicao_corporal");
      const compHistory = compRows
        .map(parseComposicao)
        .filter((x): x is ComposicaoSnapshot => !!x);

      const plioRows = rows.filter((r) => r.tipo === "pliometria");
      const plioHistory = plioRows
        .map(parsePliometria)
        .filter((x): x is PliometriaSnapshot => !!x);

      return {
        aluno: aluno ?? null,
        avaliador,
        funcional: { latest: mergedFunc, history: funcHistory },
        composicao: { latest: compHistory[0] ?? null, history: compHistory },
        pliometria: { latest: plioHistory[0] ?? null, history: plioHistory },
        raw: rows,
      };
    },
  });
}

/**
 * Carrega toda a base de referência Fortem de mobilidade/flexibilidade (leve,
 * ~3 mil linhas) uma vez por sessão e organiza em arrays ordenados por
 * métrica/sexo, prontos para busca binária de percentil (ver percentilMobilidade).
 */
/** Ordenação estável usada na paginação das tabelas de referência. */
const ORDEM_REFERENCIA = [{ coluna: "metrica" }, { coluna: "id" }];

export function useMobilidadeReferenceData() {
  return useQuery<MobilidadeReferenceData>({
    queryKey: ["mobilidade-referencia-fortem-v2"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const data = await carregarTodasAsPaginas<{
        metrica: string;
        sexo: string;
        valor: number | string;
        faixa_etaria: string | null;
      }>({
        tabela: "mobilidade_amostras_fortem",
        colunas: "metrica, sexo, valor, faixa_etaria",
        ordenarPor: ORDEM_REFERENCIA,
      });
      const ref: MobilidadeReferenceData = {};
      for (const row of data ?? []) {
        const bucket = (ref[row.metrica] ??= { M: criarReferenciaFaixas(), F: criarReferenciaFaixas() });
        const porSexo = bucket[row.sexo as "M" | "F"];
        if (!porSexo) continue;
        const valor = Number(row.valor);
        porSexo.todos.push(valor);
        const faixa = row.faixa_etaria as FaixaEtaria | null;
        if (faixa && faixa in porSexo) porSexo[faixa].push(valor);
      }
      ordenarReferencia(ref);
      avisarMetricasFaltantes(ref, "mobilidade_amostras_fortem");
      return ref;
    },
  });
}

/** Avisa se alguma das nove métricas funcionais ficou sem amostra na referência. */
function avisarMetricasFaltantes(
  ref: Record<string, { M: ReferenciaFaixas; F: ReferenciaFaixas }>,
  tabela: string,
) {
  const faltantes = ALL_FUNCTIONAL_METRICS.filter((metrica) => {
    const bucket = ref[metrica];
    return !bucket || (bucket.M.todos.length === 0 && bucket.F.todos.length === 0);
  });
  if (faltantes.length > 0) {
    console.warn(
      `[referencia-fortem] ${tabela}: sem amostras para ${faltantes.length} métrica(s): ${faltantes.join(", ")}`,
    );
  }
}

/** Ordena ascendente todos os arrays (por sexo e faixa) para busca binária. */
function ordenarReferencia(ref: Record<string, { M: ReferenciaFaixas; F: ReferenciaFaixas }>) {
  const asc = (a: number, b: number) => a - b;
  for (const bucket of Object.values(ref)) {
    for (const porSexo of [bucket.M, bucket.F]) {
      porSexo.todos.sort(asc);
      for (const faixa of FAIXAS_ETARIAS) porSexo[faixa].sort(asc);
    }
  }
}
