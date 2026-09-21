import {
  analyze,
  applyForcaToRegions,
  ASSIMETRIA_NIVEL_LABEL,
  type BodyMapAnalysis,
  type ForcaInput,
  type MetricInput,
  type MobilidadeReferenceData,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { ComposicaoSnapshot, FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";
import type { FaixaEtaria } from "@/lib/faixaEtaria";

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
  composicao: string;
  assimetria: string;
  risco: string;
}

export interface PremiumScores {
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
  sexo?: "M" | "F",
  referenceData?: MobilidadeReferenceData,
  faixaEtaria?: FaixaEtaria | null,
): PremiumScores {
  const metrics: MetricInput[] = funcional?.metricas ?? [];
  const forcaInputs: ForcaInput[] = (funcional?.forca ?? []).map((e) => ({
    nome: e.nome,
    direito_kg: e.direito_kg,
    esquerdo_kg: e.esquerdo_kg,
  }));

  const analysisAsym = analyze(metrics, "asymmetry", forcaInputs, sexo, referenceData, faixaEtaria);
  const analysisQualityBase = analyze(metrics, "asymmetry", forcaInputs, sexo, referenceData, faixaEtaria);
  const analysisQuality =
    forcaInputs.length > 0 ? applyForcaToRegions(analysisQualityBase, forcaInputs) : analysisQualityBase;

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

  const semDados = "Sem dados suficientes para cálculo. Realize uma avaliação funcional/composição.";
  const justificativas: PremiumJustificativas = {
    composicao:
      composicaoScore === null
        ? semDados
        : `% gordura = ${composicao!.bf.toFixed(1)}% (sexo ${composicao!.sexo}) → faixa Pollock: ${composicao!.classificacao || "—"}.`,
    assimetria:
      assimetria === null
        ? semDados
        : `${analysisAsym.asymmetries.length} assimetria(s) detectada(s) (${sev} no nível ${ASSIMETRIA_NIVEL_LABEL.severa}, ${mod} no nível ${ASSIMETRIA_NIVEL_LABEL.moderada}). 100 = perfeitamente simétrico.`,
    risco:
      risco === null
        ? semDados
        : `Combina assimetrias no nível ${ASSIMETRIA_NIVEL_LABEL.severa} (-25 cada), no nível ${ASSIMETRIA_NIVEL_LABEL.moderada} (-10 cada) e cadeias compensatórias (-8 cada). Detectadas: ${sev} no nível ${ASSIMETRIA_NIVEL_LABEL.severa}, ${mod} no nível ${ASSIMETRIA_NIVEL_LABEL.moderada}, ${chains} cadeia(s).`,
  };

  return {
    composicao: composicaoScore,
    assimetria,
    risco,
    analysisQuality,
    analysisAsym,
    funcForcaInputs: forcaInputs,
    justificativas,
  };
}
