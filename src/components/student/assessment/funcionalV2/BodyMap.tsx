import { useMemo, useState } from "react";
import { Activity, GitCompareArrows, ShieldAlert, Layers, Move, Save, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BodyMapSVG } from "./BodyMapSVG";
import { analyze, type Layer, type Mode, type MetricInput, type RegionId } from "./bodyMapLogic";
import { useBodyMapGeometry, type OverrideMap } from "./useBodyMapGeometry";
import { Button } from "@/components/ui/button";

interface Props {
  metrics: MetricInput[];
}

const MODES: Array<{ id: Mode; label: string; icon: typeof Activity; desc: string }> = [
  { id: "quality",   label: "Qualidade",  icon: Activity,        desc: "Heatmap geral por região" },
  { id: "asymmetry", label: "Assimetria", icon: GitCompareArrows, desc: "Diferenças bilaterais" },
  { id: "risk",      label: "Risco",      icon: ShieldAlert,     desc: "Compensações e déficits" },
];

const LAYERS: Array<{ id: Layer; label: string }> = [
  { id: "mobility",    label: "Mobilidade" },
  { id: "flexibility", label: "Flexibilidade" },
  { id: "asymmetry",   label: "Tudo" },
];

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

export function BodyMap({ metrics }: Props) {
  const [mode, setMode] = useState<Mode>("quality");
  const [layer, setLayer] = useState<Layer>("mobility");

  const analysis = useMemo(() => analyze(metrics, layer), [metrics, layer]);
  const risk = RISK_STYLE[analysis.riskLevel];

  return (
    <div className="bodymap-surface rounded-xl p-5 md:p-6 space-y-5">
      {/* Header — Índice Funcional FORTEM */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-semibold">
            Índice Funcional FORTEM
          </p>
          <p className="text-2xl font-heading font-bold text-white mt-1">
            Mapa Corporal Biomecânico
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: `hsl(${risk.color} / 0.15)`,
                color: `hsl(${risk.color})`,
                border: `1px solid hsl(${risk.color} / 0.35)`,
              }}
            >
              <ShieldAlert className="w-3 h-3" />
              {risk.label}
            </span>
            {analysis.asymmetries.length > 0 && (
              <span className="text-[11px] text-white/50">
                {analysis.asymmetries.length} assimetria(s) detectada(s)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing value={analysis.scoreGeral} label="Geral" size={96} />
          <ScoreRing value={analysis.scoreMobilidade} label="Mobilidade" />
          <ScoreRing value={analysis.scoreSimetria} label="Simetria" />
          <ScoreRing value={analysis.scoreEstabilidade} label="Estabilidade" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-white/5">
        <div className="inline-flex p-1 rounded-lg bg-white/5 border border-white/5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.desc}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/55 hover:text-white/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] text-white/55">
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
      </div>

      {/* SVG */}
      <BodyMapSVG analysis={analysis} mode={mode} />

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-white/5">
        {(["excellent","good","medium","attention","weak"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: `hsl(var(--sev-${s}))`,
                boxShadow: `0 0 10px hsl(var(--sev-${s}) / 0.7)`,
              }}
            />
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              {s === "excellent" ? "Excelente" :
               s === "good" ? "Bom" :
               s === "medium" ? "Médio" :
               s === "attention" ? "Atenção" : "Déficit"}
            </span>
          </div>
        ))}
      </div>

      {/* Chain explanations */}
      {analysis.chains.length > 0 && (
        <div className="rounded-lg bg-white/5 border border-white/5 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
            Cadeias compensatórias
          </p>
          <ul className="text-[11px] text-white/70 space-y-1">
            {analysis.chains.map((c, i) => (
              <li key={i} className="leading-snug">• {c.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
