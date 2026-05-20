import type { AssessmentClassification } from "@/lib/mock-data";

export type Side = "left" | "right";
export type Severity = "excellent" | "good" | "medium" | "attention" | "weak" | "none";
export type Mode = "quality" | "asymmetry" | "risk";
export type Layer = "mobility" | "flexibility" | "pain" | "strength" | "asymmetry";

export type RegionId =
  | "shoulder-l" | "shoulder-r"
  | "shoulder-re-l" | "shoulder-re-r"
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
  asymmetries: Array<{ region: RegionId; diff: number; severity: "moderate" | "severe" }>;
  riskLevel: "low" | "attention" | "high";
  chains: CompensationChain[];
}

const ALL_REGIONS: RegionId[] = [
  "shoulder-l","shoulder-r","shoulder-re-l","shoulder-re-r","thoracic","lumbar",
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

export function analyze(metrics: MetricInput[], layer: Layer = "mobility"): BodyMapAnalysis {
  const regions: Record<RegionId, RegionState> = Object.fromEntries(
    ALL_REGIONS.map((r) => [r, emptyRegion(r)]),
  ) as Record<RegionId, RegionState>;

  const includeForLayer = (metricLayer: MetricMeta["layer"]): boolean => {
    if (layer === "asymmetry") return true;
    if (layer === "pain" || layer === "strength") return false;
    return metricLayer === layer;
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
        const lScore = m.leftClass ? CLASS_SCORE[m.leftClass] : null;
        const rScore = m.rightClass ? CLASS_SCORE[m.rightClass] : null;
        const avg =
          lScore !== null && rScore !== null ? (lScore + rScore) / 2 :
          lScore ?? rScore;
        if (avg !== null) pushScore(r.both, avg);
        regions[r.both].contributing.push(
          { metric: m.metric, side: "left", value: m.left, classification: m.leftClass },
          { metric: m.metric, side: "right", value: m.right, classification: m.rightClass },
        );
      } else {
        if (m.leftClass) {
          pushScore(r.left, CLASS_SCORE[m.leftClass]);
          regions[r.left].contributing.push({ metric: m.metric, side: "left", value: m.left, classification: m.leftClass });
        }
        if (m.rightClass) {
          pushScore(r.right, CLASS_SCORE[m.rightClass]);
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
  const regionDiffs: Partial<Record<RegionId, { diff: number; weakerSide: "left" | "right" }>> = {};

  for (const m of metrics) {
    const meta = METRIC_META[m.metric];
    if (!meta || !includeForLayer(meta.layer)) continue;
    if (!m.leftClass || !m.rightClass) continue;
    const lScore = CLASS_SCORE[m.leftClass];
    const rScore = CLASS_SCORE[m.rightClass];
    const diff = Math.abs(lScore - rScore);
    if (diff === 0) continue;
    const weakerSide: "left" | "right" = lScore < rScore ? "left" : "right";

    for (const r of meta.regions) {
      if ("both" in r) continue;
      for (const regionId of [r.left, r.right]) {
        const prev = regionDiffs[regionId];
        if (!prev || diff > prev.diff) regionDiffs[regionId] = { diff, weakerSide };
      }
    }
  }

  for (const [a, b] of pairs) {
    const info = regionDiffs[a] ?? regionDiffs[b];
    if (!info) continue;
    regions[a].asymmetry = info.diff;
    regions[b].asymmetry = info.diff;
    const weakerRegion = info.weakerSide === "left" ? a : b;
    if (info.diff >= 25) asymmetries.push({ region: weakerRegion, diff: info.diff, severity: "severe" });
    else if (info.diff >= 15) asymmetries.push({ region: weakerRegion, diff: info.diff, severity: "moderate" });
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
    if (!m.leftClass || !m.rightClass) continue;
    if (meta.regions.every((r) => "both" in r)) continue;
    asymDiffs.push(Math.abs(CLASS_SCORE[m.leftClass] - CLASS_SCORE[m.rightClass]));
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
    asymmetries,
    riskLevel,
    chains,
  };
}
