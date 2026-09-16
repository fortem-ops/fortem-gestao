import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AssimetriaReferenceData, ForcaInput, MetricInput, MobilidadeReferenceData, ReferenciaFaixas } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { ALL_FUNCTIONAL_METRICS, ASSIMETRIA_ABSOLUTA, criarReferenciaFaixas } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
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
      }>("mobilidade_amostras_fortem", "metrica, sexo, valor, faixa_etaria");
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

export function useMobilidadeAssimetriaReferenceData() {
  return useQuery<AssimetriaReferenceData>({
    queryKey: ["mobilidade-assimetria-referencia-fortem-v2"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const data = await carregarTodasAsPaginas<{
        metrica: string;
        sexo: string;
        assimetria_pct: number | string;
        faixa_etaria: string | null;
      }>("mobilidade_assimetria_fortem", "metrica, sexo, assimetria_pct, faixa_etaria");
      const ref: AssimetriaReferenceData = {};
      for (const row of data ?? []) {
        const bucket = (ref[row.metrica] ??= { M: criarReferenciaFaixas(), F: criarReferenciaFaixas() });
        const porSexo = bucket[row.sexo as "M" | "F"];
        if (!porSexo) continue;
        const valor = Number(row.assimetria_pct);
        porSexo.todos.push(valor);
        const faixa = row.faixa_etaria as FaixaEtaria | null;
        if (faixa && faixa in porSexo) porSexo[faixa].push(valor);
      }
      ordenarReferencia(ref);
      avisarMetricasFaltantes(ref, "mobilidade_assimetria_fortem");
      return ref;
    },
  });
}

const PAGINA_REFERENCIA = 1000;
const MAX_PAGINAS_REFERENCIA = 20;

/**
 * O PostgREST corta respostas em 1.000 linhas. As tabelas de referência já
 * passam disso, então é obrigatório paginar com `range` e uma ordenação
 * estável (metrica, id) para não repetir nem pular linhas entre as páginas.
 */
async function carregarTodasAsPaginas<T>(
  tabela: "mobilidade_amostras_fortem" | "mobilidade_assimetria_fortem",
  colunas: string,
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS_REFERENCIA; pagina++) {
    const inicio = pagina * PAGINA_REFERENCIA;
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .order("metrica", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, inicio + PAGINA_REFERENCIA - 1);
    if (error) throw error;
    const linhas = (data ?? []) as unknown as T[];
    todas.push(...linhas);
    if (linhas.length < PAGINA_REFERENCIA) return todas;
  }
  console.warn(
    `[referencia-fortem] limite de ${MAX_PAGINAS_REFERENCIA} páginas atingido em ${tabela}; a base de referência pode estar incompleta.`,
  );
  return todas;
}

/** Avisa se alguma das nove métricas funcionais ficou sem amostra na referência. */
function avisarMetricasFaltantes(
  ref: Record<string, { M: ReferenciaFaixas; F: ReferenciaFaixas }>,
  tabela: string,
) {
  // Na tabela de assimetria, métricas avaliadas por diferença absoluta em graus
  // (ex.: Flexibilidade Psoas) não têm amostras por design — ausência esperada.
  const metricasEsperadas =
    tabela === "mobilidade_assimetria_fortem"
      ? ALL_FUNCTIONAL_METRICS.filter((metrica) => !(metrica in ASSIMETRIA_ABSOLUTA))
      : ALL_FUNCTIONAL_METRICS;
  const faltantes = metricasEsperadas.filter((metrica) => {
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
