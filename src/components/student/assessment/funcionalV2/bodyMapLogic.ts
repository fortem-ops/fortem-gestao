import type { AssessmentClassification } from "@/lib/mock-data";

export type Side = "left" | "right";
export type Severity = "excellent" | "good" | "medium" | "attention" | "weak" | "none";
export type Mode = "quality" | "asymmetry" | "risk";
export type Layer = "mobility" | "flexibility" | "pain" | "strength" | "asymmetry";

export type RegionId =
  | "shoulder-l" | "shoulder-r"
  | "shoulder-re-l" | "shoulder-re-r"
  | "elbow-l" | "elbow-r"
  | "wrist-l" | "wrist-r"
  | "thoracic"
  | "lumbar"
  | "hip-l" | "hip-r"
  | "hip-re-l" | "hip-re-r"
  | "psoas-l" | "psoas-r"
  | "quad-l" | "quad-r"
  | "ham-l" | "ham-r"
  | "ankle-l" | "ankle-r";

export interface MetricInput {
  metric: string;
  left: number | null;
  right: number | null;
  leftClass: AssessmentClassification | null;
  rightClass: AssessmentClassification | null;
  /** Optional 0–10 pain score (collected only in v2). */
  painLeft?: number | null;
  painRight?: number | null;
  /** Optional 1–5 strength score (collected only in v2). */
  strengthLeft?: number | null;
  strengthRight?: number | null;
}

export const ALL_FUNCTIONAL_METRICS = [
  "Flexibilidade Posterior MMII",
  "Mobilidade Ombro RI",
  "Mobilidade Ombro RE",
  "Flexibilidade Psoas",
  "Flexibilidade Quadríceps",
  "Mobilidade Quadril RI",
  "Mobilidade Quadril RE",
  "Mobilidade Torácica",
  "Mobilidade Tornozelo",
];

export const METRIC_DISPLAY_LABEL: Record<string, string> = {
  "Flexibilidade Posterior MMII": "Flexibilidade Posterior de Coxa",
  "Mobilidade Ombro RI": "Mobilidade Ombro - Rotação Interna",
  "Mobilidade Ombro RE": "Mobilidade Ombro - Rotação Externa",
  "Mobilidade Quadril RI": "Mobilidade Quadril - Rotação Interna",
  "Mobilidade Quadril RE": "Mobilidade Quadril - Rotação Externa",
};

export function getMetricDisplayLabel(metric: string): string {
  return METRIC_DISPLAY_LABEL[metric] ?? metric;
}

interface MetricMeta {
  layer: Exclude<Layer, "pain" | "strength" | "asymmetry">;
  regions: ReadonlyArray<{ left: RegionId; right: RegionId } | { both: RegionId }>;
  unit?: string;
}

export const METRIC_META: Record<string, MetricMeta> = {
  "Mobilidade Ombro RI": { layer: "mobility", regions: [{ left: "shoulder-l", right: "shoulder-r" }], unit: "°" },
  "Mobilidade Ombro RE": { layer: "mobility", regions: [{ left: "shoulder-re-l", right: "shoulder-re-r" }], unit: "°" },
  "Mobilidade Torácica": { layer: "mobility", regions: [{ both: "thoracic" }], unit: "°" },
  "Mobilidade Quadril RI": { layer: "mobility", regions: [{ left: "hip-l", right: "hip-r" }], unit: "°" },
  "Mobilidade Quadril RE": { layer: "mobility", regions: [{ left: "hip-re-l", right: "hip-re-r" }], unit: "°" },
  "Mobilidade Tornozelo": { layer: "mobility", regions: [{ left: "ankle-l", right: "ankle-r" }], unit: "°" },
  "Flexibilidade Psoas": { layer: "flexibility", regions: [{ left: "quad-l", right: "quad-r" }, { left: "psoas-l", right: "psoas-r" }], unit: "°" },
  "Flexibilidade Quadríceps": { layer: "flexibility", regions: [{ left: "quad-l", right: "quad-r" }], unit: "°" },
  "Flexibilidade Posterior MMII": { layer: "flexibility", regions: [{ left: "ham-l", right: "ham-r" }], unit: "°" },
};

const CLASS_SCORE: Record<AssessmentClassification, number> = {
  Excelente: 100,
  Bom: 85,
  Médio: 70,
  Regular: 50,
  Fraco: 25,
};

export type MobilidadeReferenceData = Record<string, { M: number[]; F: number[] }>;

/** Métricas onde valor MENOR é melhor (hoje só Psoas — teste de encurtamento). */
const METRICAS_INVERTIDAS = new Set(["Flexibilidade Psoas"]);

/**
 * Percentil do valor do aluno dentro da base interna Fortem (por métrica/sexo).
 * Requer amostra mínima de 15 (mesmo limiar usado na Força) para evitar percentil
 * ruidoso em métricas com poucos dados ainda (ex: recém adicionadas).
 */
export function percentilMobilidade(
  metric: string,
  sexo: "M" | "F",
  valor: number | null,
  ref: MobilidadeReferenceData | undefined,
): number | null {
  if (valor === null || !ref) return null;
  const arr = ref[metric]?.[sexo];
  if (!arr || arr.length < 15) return null;
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= valor) lo = mid + 1; else hi = mid;
  }
  const pct = Math.round((lo / arr.length) * 100);
  return METRICAS_INVERTIDAS.has(metric) ? 100 - pct : pct;
}

export type AssimetriaReferenceData = Record<string, { M: number[]; F: number[] }>;

/**
 * Percentil da MAGNITUDE de assimetria (diferença % bruta em graus entre E/D)
 * dentro da base Fortem, por métrica/sexo. Percentil ALTO = assimetria MAIOR (pior).
 */
export function percentilAssimetria(
  metric: string,
  sexo: "M" | "F",
  assimetriaPct: number,
  ref: AssimetriaReferenceData | undefined,
): number | null {
  if (!ref) return null;
  const arr = ref[metric]?.[sexo];
  if (!arr || arr.length < 15) return null;
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= assimetriaPct) lo = mid + 1; else hi = mid;
  }
  return Math.round((lo / arr.length) * 100);
}




export function severityFromScore(score: number | null): Severity {
  if (score === null) return "none";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "medium";
  if (score >= 40) return "attention";
  return "weak";
}

export function severityFromClass(c: AssessmentClassification | null): Severity {
  if (!c) return "none";
  return severityFromScore(CLASS_SCORE[c]);
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  excellent: "Excelente",
  good: "Bom",
  medium: "Médio",
  attention: "Atenção",
  weak: "Déficit",
  none: "Sem dado",
};

export const SEVERITY_COLOR_VAR: Record<Severity, string> = {
  excellent: "var(--sev-excellent)",
  good: "var(--sev-good)",
  medium: "var(--sev-medium)",
  attention: "var(--sev-attention)",
  weak: "var(--sev-weak)",
  none: "var(--bodymap-silhouette)",
};

export interface RegionState {
  region: RegionId;
  side: Side | "center";
  /** 0–100; null when no data */
  score: number | null;
  severity: Severity;
  /** for asymmetry mode; absolute diff vs opposite side */
  asymmetry?: number;
  contributing: Array<{ metric: string; side: Side | "center"; value: number | null; classification: AssessmentClassification | null }>;
}

export interface CompensationChain {
  from: RegionId;
  to: RegionId;
  reason: string;
}

export interface BodyMapAnalysis {
  regions: Record<RegionId, RegionState>;
  scoreGeral: number | null;
  scoreMobilidade: number | null;
  scoreSimetria: number | null;
  scoreEstabilidade: number | null;
  scoreForca: number | null;
  asymmetries: Array<{ region: RegionId; diff: number; severity: "moderate" | "severe" }>;
  metricAsymmetries: Array<{ metric: string; diff: number; asymPercentile: number | null }>;
  riskLevel: "low" | "attention" | "high";
  chains: CompensationChain[];
}

const ALL_REGIONS: RegionId[] = [
  "shoulder-l","shoulder-r","shoulder-re-l","shoulder-re-r",
  "elbow-l","elbow-r","wrist-l","wrist-r",
  "thoracic","lumbar",
  "hip-l","hip-r","hip-re-l","hip-re-r","psoas-l","psoas-r",
  "quad-l","quad-r","ham-l","ham-r","ankle-l","ankle-r",
];

function emptyRegion(id: RegionId): RegionState {
  const isCenter = id === "thoracic" || id === "lumbar";
  return {
    region: id,
    side: isCenter ? "center" : (id.endsWith("-l") ? "left" : "right"),
    score: null,
    severity: "none",
    contributing: [],
  };
}

export function analyze(
  metrics: MetricInput[],
  layer: Layer = "mobility",
  strengthExercises?: ForcaInput[],
  sexo?: "M" | "F",
  referenceData?: MobilidadeReferenceData,
  assimetriaReferenceData?: AssimetriaReferenceData,
): BodyMapAnalysis {
  const regions: Record<RegionId, RegionState> = Object.fromEntries(
    ALL_REGIONS.map((r) => [r, emptyRegion(r)]),
  ) as Record<RegionId, RegionState>;

  const includeForLayer = (metricLayer: MetricMeta["layer"]): boolean => {
    if (layer === "asymmetry") return true;
    if (layer === "pain" || layer === "strength") return false;
    return metricLayer === layer;
  };

  const scoreForSide = (m: MetricInput, side: "left" | "right"): number | null => {
    if (sexo && referenceData) {
      const pct = percentilMobilidade(m.metric, sexo, side === "left" ? m.left : m.right, referenceData);
      if (pct !== null) return pct;
    }
    const cls = side === "left" ? m.leftClass : m.rightClass;
    return cls ? CLASS_SCORE[cls] : null;
  };

  // Aggregate scores per region/side
  const buckets: Record<string, number[]> = {};
  const pushScore = (regionId: RegionId, score: number) => {
    (buckets[regionId] = buckets[regionId] || []).push(score);
  };

  for (const m of metrics) {
    const meta = METRIC_META[m.metric];
    if (!meta || !includeForLayer(meta.layer)) continue;
    for (const r of meta.regions) {
      if ("both" in r) {
        const lScore = scoreForSide(m, "left");
        const rScore = scoreForSide(m, "right");
        const avg =
          lScore !== null && rScore !== null ? (lScore + rScore) / 2 :
          lScore ?? rScore;
        if (avg !== null) pushScore(r.both, avg);
        regions[r.both].contributing.push(
          { metric: m.metric, side: "left", value: m.left, classification: m.leftClass },
          { metric: m.metric, side: "right", value: m.right, classification: m.rightClass },
        );
      } else {
        const lScore = scoreForSide(m, "left");
        if (lScore !== null) {
          pushScore(r.left, lScore);
          regions[r.left].contributing.push({ metric: m.metric, side: "left", value: m.left, classification: m.leftClass });
        }
        const rScore = scoreForSide(m, "right");
        if (rScore !== null) {
          pushScore(r.right, rScore);
          regions[r.right].contributing.push({ metric: m.metric, side: "right", value: m.right, classification: m.rightClass });
        }
      }
    }
  }

  for (const id of ALL_REGIONS) {
    const arr = buckets[id];
    if (arr && arr.length) {
      const score = arr.reduce((a, b) => a + b, 0) / arr.length;
      regions[id].score = Math.round(score);
      regions[id].severity = severityFromScore(score);
    }
  }

  // Asymmetries — sempre correlacionar a MESMA métrica entre lado E e D,
  // depois agregar por região (mantendo a maior assimetria observada).
  const asymmetries: BodyMapAnalysis["asymmetries"] = [];
  const pairs: Array<[RegionId, RegionId]> = [
    ["shoulder-l","shoulder-r"],
    ["shoulder-re-l","shoulder-re-r"],
    ["hip-l","hip-r"],
    ["hip-re-l","hip-re-r"],
    ["psoas-l","psoas-r"],
    ["quad-l","quad-r"],
    ["ham-l","ham-r"],
    ["ankle-l","ankle-r"],
  ];
  const regionDiffs: Partial<Record<RegionId, { diff: number; weakerSide: "left" | "right"; asymPercentile: number | null }>> = {};
  const metricAsymmetries: BodyMapAnalysis["metricAsymmetries"] = [];

  for (const m of metrics) {
    const meta = METRIC_META[m.metric];
    if (!meta || !includeForLayer(meta.layer)) continue;
    const lScore = scoreForSide(m, "left");
    const rScore = scoreForSide(m, "right");
    if (lScore === null || rScore === null) continue;
    const rawAsymPct =
      m.left !== null && m.right !== null && Math.max(Math.abs(m.left), Math.abs(m.right)) > 0
        ? (Math.abs(m.left - m.right) / Math.max(Math.abs(m.left), Math.abs(m.right))) * 100
        : null;
    if (rawAsymPct === null || rawAsymPct === 0) continue;
    const asymPercentile = sexo ? percentilAssimetria(m.metric, sexo, rawAsymPct, assimetriaReferenceData) : null;
    metricAsymmetries.push({ metric: m.metric, diff: rawAsymPct, asymPercentile });
    const weakerSide: "left" | "right" = lScore < rScore ? "left" : "right";

    for (const r of meta.regions) {
      if ("both" in r) {
        const prev = regionDiffs[r.both];
        if (!prev || rawAsymPct > prev.diff) regionDiffs[r.both] = { diff: rawAsymPct, weakerSide, asymPercentile };
        continue;
      }
      for (const regionId of [r.left, r.right]) {
        const prev = regionDiffs[regionId];
        if (!prev || rawAsymPct > prev.diff) regionDiffs[regionId] = { diff: rawAsymPct, weakerSide, asymPercentile };
      }
    }
  }

  const pairedRegionIds = new Set<RegionId>(pairs.flat());

  for (const [a, b] of pairs) {
    const info = regionDiffs[a] ?? regionDiffs[b];
    if (!info) continue;
    regions[a].asymmetry = info.diff;
    regions[b].asymmetry = info.diff;
    const weakerRegion = info.weakerSide === "left" ? a : b;
    const sevByPercentile: "severe" | "moderate" | null =
      info.asymPercentile !== null && info.asymPercentile !== undefined
        ? info.asymPercentile >= 90 ? "severe" : info.asymPercentile >= 75 ? "moderate" : null
        : null;
    const sevByFixedCut: "severe" | "moderate" | null =
      info.diff >= 25 ? "severe" : info.diff >= 15 ? "moderate" : null;
    const finalSev = sevByPercentile ?? sevByFixedCut;
    if (finalSev) asymmetries.push({ region: weakerRegion, diff: info.diff, severity: finalSev });
  }

  // Regiões "both" com dado E/D real (ex: torácica — rotação de tronco), atribuídas
  // a um único RegionId (não têm par esquerdo/direito distinto no mapa).
  for (const regionId of Object.keys(regionDiffs) as RegionId[]) {
    if (pairedRegionIds.has(regionId)) continue;
    const info = regionDiffs[regionId];
    if (!info) continue;
    regions[regionId].asymmetry = info.diff;
    const sevByPercentile: "severe" | "moderate" | null =
      info.asymPercentile !== null && info.asymPercentile !== undefined
        ? info.asymPercentile >= 90 ? "severe" : info.asymPercentile >= 75 ? "moderate" : null
        : null;
    const sevByFixedCut: "severe" | "moderate" | null =
      info.diff >= 25 ? "severe" : info.diff >= 15 ? "moderate" : null;
    const finalSev = sevByPercentile ?? sevByFixedCut;
    if (finalSev) asymmetries.push({ region: regionId, diff: info.diff, severity: finalSev });
  }

  // Compensation chains
  const chains: CompensationChain[] = [];
  const isWeak = (id: RegionId) => regions[id].severity === "weak" || regions[id].severity === "attention";
  if (isWeak("ankle-l")) chains.push({ from: "ankle-l", to: "hip-l", reason: "Cadeia ipsilateral: tornozelo limitado pode sobrecarregar joelho e quadril." });
  if (isWeak("ankle-r")) chains.push({ from: "ankle-r", to: "hip-r", reason: "Cadeia ipsilateral: tornozelo limitado pode sobrecarregar joelho e quadril." });
  if (isWeak("thoracic")) {
    chains.push({ from: "thoracic", to: "shoulder-l", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." });
    chains.push({ from: "thoracic", to: "shoulder-r", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." });
  }
  if (isWeak("ham-l") && isWeak("quad-l")) chains.push({ from: "ham-l", to: "lumbar", reason: "Cadeia anterior e posterior curtas: risco de sobrecarga lombar." });
  if (isWeak("ham-r") && isWeak("quad-r")) chains.push({ from: "ham-r", to: "lumbar", reason: "Cadeia anterior e posterior curtas: risco de sobrecarga lombar." });

  // Sub-scores
  const mobilityRegions: RegionId[] = ["shoulder-l","shoulder-r","thoracic","hip-l","hip-r","ankle-l","ankle-r"];
  const allRegionScores = ALL_REGIONS.map((id) => regions[id].score).filter((s): s is number => s !== null);
  const mobScores = mobilityRegions.map((id) => regions[id].score).filter((s): s is number => s !== null);
  const mean = (xs: number[]) => xs.length ? xs.reduce((a,b) => a+b, 0) / xs.length : null;

  const scoreMobilidade = mean(mobScores);
  // Simetria baseada nas assimetrias por métrica (E vs D na mesma métrica)
  const asymDiffs: number[] = [];
  for (const m of metrics) {
    const meta = METRIC_META[m.metric];
    if (!meta || !includeForLayer(meta.layer)) continue;
    if (meta.regions.every((r) => "both" in r)) continue;
    const lScore = scoreForSide(m, "left");
    const rScore = scoreForSide(m, "right");
    if (lScore === null || rScore === null) continue;
    asymDiffs.push(Math.abs(lScore - rScore));
  }
  const scoreSimetria = asymDiffs.length
    ? Math.max(0, Math.round(100 - (asymDiffs.reduce((a,b) => a+b, 0) / asymDiffs.length) * 1.6))
    : null;
  const scoreEstabilidade = mean(allRegionScores);

  // === Força (camada nova, alimentada por laudo Kinology) ===
  const scoreForca = computeForcaScore(strengthExercises);

  const scoreGeral = (() => {
    const hasForca = scoreForca !== null;
    const w = hasForca
      ? { mob: 0.30, sim: 0.25, est: 0.25, forca: 0.20 }
      : { mob: 0.40, sim: 0.30, est: 0.30, forca: 0 };
    const pairs: Array<[number | null, number]> = [
      [scoreMobilidade, w.mob],
      [scoreSimetria, w.sim],
      [scoreEstabilidade, w.est],
      [scoreForca, w.forca],
    ];
    let sum = 0, wsum = 0;
    for (const [v, weight] of pairs) {
      if (v === null || weight === 0) continue;
      sum += v * weight;
      wsum += weight;
    }
    return wsum > 0 ? Math.round(sum / wsum) : null;
  })();

  // Risk
  const severeCount = asymmetries.filter((a) => a.severity === "severe").length;
  const weakRegions = ALL_REGIONS.filter((id) => regions[id].severity === "weak").length;
  let riskLevel: BodyMapAnalysis["riskLevel"] = "low";
  if (severeCount >= 2 || weakRegions >= 3 || chains.length >= 3) riskLevel = "high";
  else if (severeCount >= 1 || weakRegions >= 1 || chains.length >= 1) riskLevel = "attention";

  return {
    regions,
    scoreGeral: scoreGeral !== null ? scoreGeral : null,
    scoreMobilidade: scoreMobilidade !== null ? Math.round(scoreMobilidade) : null,
    scoreSimetria,
    scoreEstabilidade: scoreEstabilidade !== null ? Math.round(scoreEstabilidade) : null,
    scoreForca: scoreForca !== null ? Math.round(scoreForca) : null,
    asymmetries,
    metricAsymmetries,
    riskLevel,
    chains,
  };
}

/** Lista de atenção por MÉTRICA (não por região/lado) — usada nas camadas Mobilidade/Flexibilidade/Tudo. */
export function buildMetricAttentionList(analysis: BodyMapAnalysis, max = 6): Array<{
  id: string;
  number: number;
  label: string;
  metricLabel: string;
  percentage: number;
}> {
  const items = [...analysis.metricAsymmetries].sort((a, b) => b.diff - a.diff).slice(0, max);
  return items.map((x, i) => ({
    id: x.metric,
    number: i + 1,
    label: getMetricDisplayLabel(x.metric),
    metricLabel: "",
    percentage: Math.round(x.diff * 10) / 10,
  }));
}

// ===================== Camada Força (Dinamometria Kinology) =====================

export type ForcaExercicio =
  | "rotacao_interna" | "rotacao_externa"
  | "flexao_ombro" | "extensao_ombro" | "abducao_ombro" | "aducao_ombro"
  | "flexao_cotovelo" | "extensao_cotovelo"
  | "pronacao_antebraco" | "supinacao_antebraco"
  | "flexao_punho" | "extensao_punho"
  | "dorsiflexao" | "flexao_plantar" | "inversao"
  | "flexao_joelho" | "extensao_joelho"
  | "flexao_quadril" | "extensao_quadril"
  | "abducao_quadril" | "aducao_quadril";

export interface ForcaInput {
  nome: ForcaExercicio;
  direito_kg: number | null;
  esquerdo_kg: number | null;
  data?: string;
}

export const FORCA_EXERCICIO_LABEL: Record<ForcaExercicio, string> = {
  rotacao_interna: "Rotação interna (ombro)",
  rotacao_externa: "Rotação externa (ombro)",
  flexao_ombro: "Flexão de ombro",
  extensao_ombro: "Extensão de ombro",
  abducao_ombro: "Abdução de ombro",
  aducao_ombro: "Adução de ombro",
  flexao_cotovelo: "Flexão de cotovelo",
  extensao_cotovelo: "Extensão de cotovelo",
  pronacao_antebraco: "Pronação do antebraço",
  supinacao_antebraco: "Supinação do antebraço",
  flexao_punho: "Flexão de punho",
  extensao_punho: "Extensão de punho",
  dorsiflexao: "Dorsiflexão",
  flexao_plantar: "Flexão plantar",
  inversao: "Inversão (tornozelo)",
  flexao_joelho: "Flexão de joelho",
  extensao_joelho: "Extensão de joelho",
  flexao_quadril: "Flexão de quadril",
  extensao_quadril: "Extensão de quadril",
  abducao_quadril: "Abdução de quadril",
  aducao_quadril: "Adução de quadril",
};

const FORCA_REGIONS: Record<ForcaExercicio, { left: RegionId; right: RegionId } | { both: RegionId }> = {
  rotacao_interna: { left: "shoulder-l", right: "shoulder-r" },
  rotacao_externa: { left: "shoulder-re-l", right: "shoulder-re-r" },
  flexao_ombro: { left: "shoulder-l", right: "shoulder-r" },
  abducao_ombro: { left: "shoulder-l", right: "shoulder-r" },
  aducao_ombro: { left: "shoulder-l", right: "shoulder-r" },
  extensao_ombro: { left: "shoulder-re-l", right: "shoulder-re-r" },
  flexao_cotovelo: { left: "elbow-l", right: "elbow-r" },
  extensao_cotovelo: { left: "elbow-l", right: "elbow-r" },
  pronacao_antebraco: { left: "elbow-l", right: "elbow-r" },
  supinacao_antebraco: { left: "elbow-l", right: "elbow-r" },
  flexao_punho: { left: "wrist-l", right: "wrist-r" },
  extensao_punho: { left: "wrist-l", right: "wrist-r" },
  dorsiflexao: { left: "ankle-l", right: "ankle-r" },
  flexao_plantar: { left: "ankle-l", right: "ankle-r" },
  inversao: { left: "ankle-l", right: "ankle-r" },
  flexao_joelho: { left: "ham-l", right: "ham-r" },
  extensao_joelho: { left: "quad-l", right: "quad-r" },
  flexao_quadril: { left: "psoas-l", right: "psoas-r" },
  extensao_quadril: { left: "ham-l", right: "ham-r" },
  abducao_quadril: { left: "hip-re-l", right: "hip-re-r" },
  aducao_quadril: { left: "hip-l", right: "hip-r" },
};


/** Classifica um exercício pela assimetria relativa (Kinology). */
export function classifyForca(direito: number, esquerdo: number): {
  assimetria: number;
  classification: AssessmentClassification;
  score: number;
} {
  const max = Math.max(direito, esquerdo);
  if (max <= 0) return { assimetria: 0, classification: "Médio", score: 70 };
  const diff = Math.abs(direito - esquerdo) / max * 100;
  if (diff < 10) return { assimetria: diff, classification: "Bom", score: 85 };
  if (diff < 20) return { assimetria: diff, classification: "Médio", score: 60 };
  return { assimetria: diff, classification: "Fraco", score: 30 };
}

export interface ForcaAttentionItem {
  id: string;
  number: number;
  label: string;
  percentage: number;
  riskLabel: string;
  riskColor: string;
}

/** Lista de atenção por exercício (não por região/lado) — usada só na camada Força. */
export function buildForcaAttentionList(exercises: ForcaInput[] | undefined, max = 6): ForcaAttentionItem[] {
  if (!exercises) return [];
  const items = exercises
    .filter((ex) => ex.direito_kg != null && ex.esquerdo_kg != null)
    .map((ex) => ({
      nome: ex.nome,
      assimetria: classifyForca(ex.direito_kg!, ex.esquerdo_kg!).assimetria,
    }))
    .filter((x) => x.assimetria > 0)
    .sort((a, b) => b.assimetria - a.assimetria)
    .slice(0, max);

  return items.map((x, i) => {
    const riskLabel = x.assimetria < 10 ? "BAIXO" : x.assimetria < 20 ? "ATENÇÃO" : "ALTO";
    const riskColor =
      x.assimetria < 10 ? "var(--sev-good)" : x.assimetria < 20 ? "var(--sev-attention)" : "var(--sev-weak)";
    return {
      id: x.nome,
      number: i + 1,
      label: FORCA_EXERCICIO_LABEL[x.nome],
      metricLabel: "",
      percentage: Math.round(x.assimetria * 10) / 10,
      riskLabel,
      riskColor,
    };
  });
}

export function computeForcaScore(exercises: ForcaInput[] | undefined): number | null {
  if (!exercises || exercises.length === 0) return null;
  const scores: number[] = [];
  let highAsym = 0;
  for (const ex of exercises) {
    if (ex.direito_kg == null || ex.esquerdo_kg == null) continue;
    const r = classifyForca(ex.direito_kg, ex.esquerdo_kg);
    scores.push(r.score);
    if (r.assimetria >= 20) highAsym++;
  }
  if (!scores.length) return null;
  const base = scores.reduce((a, b) => a + b, 0) / scores.length;
  const penalty = highAsym >= 1 ? 10 : 0;
  return Math.max(0, base - penalty);
}

/** Aplica resultados de força como halos no analysis (camada strength). */
export function applyForcaToRegions(
  analysis: BodyMapAnalysis,
  exercises: ForcaInput[],
): BodyMapAnalysis {
  const buckets: Partial<Record<RegionId, number[]>> = {};
  const asymBuckets: Partial<Record<RegionId, { assimetria: number; exercicio: ForcaExercicio }>> = {};
  for (const ex of exercises) {
    if (ex.direito_kg == null || ex.esquerdo_kg == null) continue;
    const region = FORCA_REGIONS[ex.nome];
    const { score, assimetria } = classifyForca(ex.direito_kg, ex.esquerdo_kg);
    const ids = "both" in region ? [region.both] : [region.left, region.right];
    for (const id of ids) {
      (buckets[id] ||= []).push(score);
      const prev = asymBuckets[id];
      if (!prev || assimetria > prev.assimetria) asymBuckets[id] = { assimetria, exercicio: ex.nome };
    }
  }
  const newRegions = { ...analysis.regions };
  for (const id of Object.keys(buckets) as RegionId[]) {
    const arr = buckets[id]!;
    const score = arr.reduce((a, b) => a + b, 0) / arr.length;
    const asym = asymBuckets[id];
    newRegions[id] = {
      ...newRegions[id],
      score: Math.round(score),
      severity: severityFromScore(score),
      asymmetry: asym ? Math.round(asym.assimetria * 10) / 10 : undefined,
      contributing: asym
        ? [{ metric: FORCA_EXERCICIO_LABEL[asym.exercicio], side: newRegions[id].side, value: null, classification: null }]
        : newRegions[id].contributing,
    };
  }
  return { ...analysis, regions: newRegions };
}
