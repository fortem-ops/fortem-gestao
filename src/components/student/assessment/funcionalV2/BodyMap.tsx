import { useMemo, useState } from "react";
import { ShieldAlert, Layers } from "lucide-react";
import { BodyMapSVG } from "./BodyMapSVG";
import { analyze, applyForcaToRegions, buildForcaAttentionList, buildMetricAttentionList, corGradienteAssimetria, type ContagemAssimetrias, type ForcaInput, type Layer, type MetricInput, type RegionId } from "./bodyMapLogic";
import { useBodyMapShapes } from "./useBodyMapShapes";

import { RegionListPanel, type RegionListItem } from "./RegionListPanel";

interface Props {
  metrics: MetricInput[];
  forcaExercises?: ForcaInput[];
  /**
   * Valores canônicos (mesma fonte que os cards do topo da página / computePremiumScores).
   * Quando fornecidos, os 5 anéis, o chip de risco e a contagem de assimetrias usam ESSES
   * valores (fixos, não dependem da camada selecionada abaixo). O heatmap SVG e a lista de
   * regiões continuam usando `analysis` (dependente da camada), isso é intencional.
   */
  canonical?: {
    geral: number | null;
    mobilidade: number | null;
    simetria: number | null;
    estabilidade: number | null;
    forca: number | null;
    riskLevel: "low" | "attention" | "high";
    asymmetryCount: number;
    chains: Array<{ from: RegionId; to: RegionId; reason: string }>;
  } | null;
  /**
   * Quando fornecido, os anéis do topo passam a exibir NÚMEROS ABSOLUTOS
   * (contagem de assimetrias por categoria) em vez de scores 0–100.
   */
  rings?: {
    mobilidade: ContagemAssimetrias;
    flexibilidade: ContagemAssimetrias;
    forca: ContagemAssimetrias;
    geral: ContagemAssimetrias;
    composicao: number | null;
  } | null;
  /**
   * Camada controlada (opcional). Quando não fornecida, o componente mantém
   * o próprio estado interno — comportamento original preservado.
   */
  layer?: Layer;
  onLayerChange?: (layer: Layer) => void;
}



const LAYERS: Array<{ id: Layer; label: string }> = [
  { id: "mobility",    label: "Mobilidade" },
  { id: "flexibility", label: "Flexibilidade" },
  { id: "strength",    label: "Força" },
  { id: "asymmetry",   label: "Tudo" },
];

const VIEW_OPTIONS: Array<{ id: "both" | "front" | "back"; label: string }> = [
  { id: "both",  label: "Ambos" },
  { id: "front", label: "Anterior" },
  { id: "back",  label: "Posterior" },
];

/** Barra de gradiente contínuo de assimetria (sem categorias nomeadas). */
function AsymmetryGradientLegend() {
  const stops = [0, 5, 10, 15, 20, 25, 30]
    .map((p) => `${corGradienteAssimetria(p)} ${(p / 30) * 100}%`)
    .join(", ");
  return (
    <div className="hidden md:flex items-center gap-2">
      <span className="text-[10px] text-white/50">menor assimetria</span>
      <span
        className="h-2 w-28 rounded-full"
        style={{ background: `linear-gradient(90deg, ${stops})` }}
        aria-hidden
      />
      <span className="text-[10px] text-white/50">maior assimetria</span>
    </div>
  );
}


function ScoreRing({ value, label, size = 88 }: { value: number | null; label: string; size?: number }) {
  const radius = size / 2 - 6;
  const circ = 2 * Math.PI * radius;
  const pct = value !== null ? Math.min(100, Math.max(0, value)) : 0;
  const color =
    value === null ? "var(--bodymap-silhouette)" :
    pct >= 85 ? "var(--sev-excellent)" :
    pct >= 70 ? "var(--sev-good)" :
    pct >= 55 ? "var(--sev-medium)" :
    pct >= 40 ? "var(--sev-attention)" : "var(--sev-weak)";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={5} />
          <circle
            cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={`hsl(${color})`} strokeWidth={5}
            strokeDasharray={`${(pct / 100) * circ} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-heading font-bold leading-none text-white">
            {value !== null ? value : "—"}
          </p>
          {value !== null && <p className="text-[9px] text-white/50">/100</p>}
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">{label}</p>
    </div>
  );
}

const RISK_STYLE: Record<"low" | "attention" | "high", { label: string; color: string }> = {
  low:       { label: "Baixo risco",            color: "var(--sev-good)" },
  attention: { label: "Atenção",                color: "var(--sev-attention)" },
  high:      { label: "Alto risco compensatório", color: "var(--sev-weak)" },
};

/** Anel de número absoluto (contagem de assimetrias). `tone` = % representativo p/ cor. */
function CountRing({ value, label, size = 88, tone }: { value: number; label: string; size?: number; tone?: number }) {
  const radius = size / 2 - 6;
  const circ = 2 * Math.PI * radius;
  const frac = Math.min(1, value / 5);
  const pctTone = tone ?? (value === 0 ? 0 : value >= 3 ? 24 : 14);
  const color = value === 0 && tone === undefined
    ? "hsl(var(--bodymap-silhouette))"
    : corGradienteAssimetria(pctTone);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={5} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={5}
            strokeDasharray={`${Math.max(frac, value > 0 ? 0.08 : 0) * circ} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xl font-heading font-bold leading-none text-white">{value}</p>
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">{label}</p>
    </div>
  );
}

export function BodyMap({ metrics, forcaExercises, canonical, rings, layer: layerProp, onLayerChange }: Props) {
  
  const [layerLocal, setLayerLocal] = useState<Layer>("mobility");
  const layer = layerProp ?? layerLocal;
  const setLayer = (l: Layer) => (onLayerChange ? onLayerChange(l) : setLayerLocal(l));
  const [viewFilter, setViewFilter] = useState<"both" | "front" | "back">("both");

  const { shapesMap } = useBodyMapShapes();

  const analysis = useMemo(() => {
    const base = analyze(metrics, layer, forcaExercises);
    if (layer === "strength" && forcaExercises && forcaExercises.length) {
      return applyForcaToRegions(base, forcaExercises);
    }
    return base;
  }, [metrics, layer, forcaExercises]);
  const risk = RISK_STYLE[analysis.riskLevel];
  const riskDisplay = canonical ? RISK_STYLE[canonical.riskLevel] : risk;
  const asymmetryCountDisplay = canonical ? canonical.asymmetryCount : analysis.asymmetries.length;
  const chainsDisplay = canonical ? canonical.chains : analysis.chains;

  const regionList = useMemo(
    () =>
      (layer === "strength"
        ? buildForcaAttentionList(forcaExercises, 6)
        : buildMetricAttentionList(analysis, 6)) as RegionListItem[],
    [analysis, layer, forcaExercises],
  );

  return (
    <div className="bodymap-surface rounded-xl p-5 md:p-6 space-y-5">
      {/* Header — Índice Funcional FORTEM */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-semibold">
             AVALIAÇÃO FUNCIONAL - FORTEM
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {rings ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-semibold text-center mb-1">
                  Assimetrias
                </p>
                <div className="flex items-center gap-2">
                  <CountRing value={rings.mobilidade.alta + rings.mobilidade.moderada} label="Mobilidade" />
                  <CountRing value={rings.flexibilidade.alta + rings.flexibilidade.moderada} label="Flexibilidade" />
                  <CountRing value={rings.forca.alta + rings.forca.moderada} label="Força" />
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-semibold text-center mb-1">
                  Risco de Lesões
                </p>
                <p className="text-[8px] text-white/40 text-center mb-1.5">assimetria de força · dinamometria</p>
                <div className="flex items-center gap-2">
                  <CountRing value={rings.forca.alta} label=">20%" size={66} tone={26} />
                  <CountRing value={rings.forca.moderada} label="10-20%" size={66} tone={15} />
                  <CountRing value={rings.forca.baixa} label="<10%" size={66} tone={4} />
                </div>
              </div>
              
            </>
          ) : (
            <>
              <ScoreRing value={canonical ? canonical.mobilidade : analysis.scoreMobilidade} label="Mobilidade" />
              <ScoreRing value={canonical ? canonical.simetria : analysis.scoreSimetria} label="Simetria" />
              <ScoreRing value={canonical ? canonical.estabilidade : analysis.scoreEstabilidade} label="Estabilidade" />
              <ScoreRing value={canonical ? canonical.forca : analysis.scoreForca} label="Força" />
            </>
          )}
        </div>
      </div>

      {/* Controls row 1: view filter */}
      <div className="flex items-center gap-3 flex-wrap pb-3 border-b border-white/5">
          {/* Escala contínua de assimetria */}
          <AsymmetryGradientLegend />


          {/* View toggle */}
          <div className="inline-flex p-1 rounded-lg bg-white/5 border border-white/5">
            {VIEW_OPTIONS.map((v) => {
              const active = viewFilter === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setViewFilter(v.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    active ? "bg-white/10 text-white" : "text-white/55 hover:text-white/80"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

      {/* Controls row 2: layer */}
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        <Layers className="w-3.5 h-3.5" />
        <span className="uppercase tracking-wider">Camada</span>
        <div className="inline-flex gap-1">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayer(l.id)}
              className={`px-2.5 py-1 rounded-md text-xs ${
                layer === l.id ? "bg-white/10 text-white" : "text-white/55 hover:text-white/80"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main: SVG + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <BodyMapSVG
          viewFilter={viewFilter}
          layer={layer}
          forcaExercises={forcaExercises}
          metrics={metrics}
          shapesMap={shapesMap}
        />

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-1">
            Pontos de atenção
          </p>
          <RegionListPanel items={regionList} />
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[11px] text-white/40 leading-relaxed">
         As porcentagens representam a diferença do lado avaliado em relação ao lado oposto.
      </p>

      {/* Chain explanations */}
      {chainsDisplay.length > 0 && (
        <div className="rounded-lg bg-[hsl(var(--bio-surface-2))] border border-[hsl(var(--bio-line))] p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--bio-ink-muted))] font-semibold">
            Cadeias compensatórias
          </p>
          <ul className="text-[11px] text-[hsl(var(--bio-ink))] space-y-1">
            {chainsDisplay.map((c, i) => (
              <li key={i} className="leading-snug">• {c.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
