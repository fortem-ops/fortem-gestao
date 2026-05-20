import {
  analyze,
  applyForcaToRegions,
  computeForcaScore,
  type BodyMapAnalysis,
  type ForcaInput,
  type MetricInput,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { ComposicaoSnapshot, FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";

export type SeverityBand = "good" | "warn" | "risk" | "none";

export function bandFromScore(s: number | null): SeverityBand {
  if (s === null) return "none";
  if (s >= 75) return "good";
  if (s >= 55) return "warn";
  return "risk";
}

export function bandLabel(b: SeverityBand): string {
  return { good: "Bom", warn: "Atenção", risk: "Risco", none: "Sem dado" }[b];
}

/** % gordura → score 0–100 (faixa Pollock por sexo). */
export function scoreComposicaoFromBF(bf: number, sexo: "M" | "F"): number {
  if (sexo === "M") {
    if (bf <= 13) return 95;
    if (bf <= 17) return 85;
    if (bf <= 20) return 75;
    if (bf <= 24) return 60;
    if (bf <= 28) return 45;
    return 25;
  }
  // F
  if (bf <= 20) return 95;
  if (bf <= 24) return 85;
  if (bf <= 28) return 75;
  if (bf <= 31) return 60;
  if (bf <= 35) return 45;
  return 25;
}

export interface PremiumJustificativas {
  indiceFortem: string;
  mobilidade: string;
  flexibilidade: string;
  forca: string;
  composicao: string;
  assimetria: string;
  risco: string;
}

export interface PremiumScores {
  indiceFortem: number | null;
  mobilidade: number | null;
  flexibilidade: number | null;
  forca: number | null;
  composicao: number | null;
  assimetria: number | null;   // 0–100 (100 = sem assimetria)
  risco: number | null;        // 0–100 (100 = baixíssimo risco)
  analysisQuality: BodyMapAnalysis;
  analysisAsym: BodyMapAnalysis;
  funcForcaInputs: ForcaInput[];
  justificativas: PremiumJustificativas;
}

export function computePremiumScores(
  funcional: FuncionalSnapshot | null,
  composicao: ComposicaoSnapshot | null,
): PremiumScores {
  const metrics: MetricInput[] = funcional?.metricas ?? [];
  const forcaInputs: ForcaInput[] = (funcional?.forca ?? []).map((e) => ({
    nome: e.nome,
    direito_kg: e.direito_kg,
    esquerdo_kg: e.esquerdo_kg,
  }));

  // Analyses isoladas por camada — mobilidade aproveita a já calculada em "mobility",
  // flexibilidade idem; força usa computeForcaScore direto.
  const analysisMobility = analyze(metrics, "mobility", forcaInputs);
  const analysisFlex = analyze(metrics, "flexibility", forcaInputs);
  const analysisAsym = analyze(metrics, "asymmetry", forcaInputs);
  const analysisQualityBase = analyze(metrics, "asymmetry", forcaInputs);
  const analysisQuality =
    forcaInputs.length > 0 ? applyForcaToRegions(analysisQualityBase, forcaInputs) : analysisQualityBase;

  const mobilidade = analysisMobility.scoreMobilidade;
  // Re-aproveita scoreMobilidade do analyze por "flexibility" (calcula sobre regiões mobilityRegions
  // — não ideal, então derivamos próprio das métricas flex).
  const flexMetrics = metrics.filter((m) =>
    /Flexibilidade/i.test(m.metric),
  );
  const flexScores: number[] = [];
  flexMetrics.forEach((m) => {
    const map: Record<string, number> = { Excelente: 100, Bom: 85, Médio: 70, Regular: 50, Fraco: 25 };
    if (m.leftClass) flexScores.push(map[m.leftClass]);
    if (m.rightClass) flexScores.push(map[m.rightClass]);
  });
  const flexibilidade = flexScores.length
    ? Math.round(flexScores.reduce((a, b) => a + b, 0) / flexScores.length)
    : null;

  const forca = computeForcaScore(forcaInputs);
  const composicaoScore = composicao
    ? scoreComposicaoFromBF(composicao.bf, composicao.sexo)
    : null;
  const assimetria = analysisAsym.scoreSimetria;

  // Risco = combinação de assimetrias severas + déficits + cadeias compensatórias
  const sev = analysisAsym.asymmetries.filter((a) => a.severity === "severe").length;
  const mod = analysisAsym.asymmetries.filter((a) => a.severity === "moderate").length;
  const chains = analysisAsym.chains.length;
  const riskRaw = Math.max(0, 100 - sev * 25 - mod * 10 - chains * 8);
  const risco = metrics.length > 0 ? riskRaw : null;

  // Índice Fortem ponderado (entradas null não pesam)
  const buckets: Array<[number | null, number]> = [
    [mobilidade, 0.25],
    [flexibilidade, 0.2],
    [forca, 0.25],
    [composicaoScore, 0.15],
    [risco, 0.15],
  ];
  let s = 0, w = 0;
  for (const [v, peso] of buckets) {
    if (v === null) continue;
    s += v * peso;
    w += peso;
  }
  const indiceFortem = w > 0 ? Math.round(s / w) : null;

  return {
    indiceFortem,
    mobilidade,
    flexibilidade,
    forca,
    composicao: composicaoScore,
    assimetria,
    risco,
    analysisQuality,
    analysisAsym,
    funcForcaInputs: forcaInputs,
  };
}
