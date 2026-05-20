import { useMemo, useState } from "react";
import { Activity, GitCompareArrows, ShieldAlert, Layers, Move, Save, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BodyMapSVG } from "./BodyMapSVG";
import { analyze, applyForcaToRegions, type ForcaInput, type Layer, type Mode, type MetricInput, type RegionId, type Severity } from "./bodyMapLogic";
import { useBodyMapGeometry, type OverrideMap } from "./useBodyMapGeometry";
import { Button } from "@/components/ui/button";
import { buildRegionList, RegionListPanel } from "./RegionListPanel";

interface Props {
  metrics: MetricInput[];
  forcaExercises?: ForcaInput[];
}

const MODES: Array<{ id: Mode; label: string; icon: typeof Activity; desc: string }> = [
  { id: "quality",   label: "Qualidade",  icon: Activity,        desc: "Heatmap geral por região" },
  { id: "asymmetry", label: "Assimetria", icon: GitCompareArrows, desc: "Diferenças bilaterais" },
  { id: "risk",      label: "Risco",      icon: ShieldAlert,     desc: "Compensações e déficits" },
];

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

const LEGEND: Array<{ s: Severity; label: string }> = [
  { s: "excellent", label: "Excelente" },
  { s: "good",      label: "Bom" },
  { s: "medium",    label: "Médio" },
  { s: "attention", label: "Atenção" },
  { s: "weak",      label: "Alto risco" },
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

export function BodyMap({ metrics, forcaExercises }: Props) {
  const [mode, setMode] = useState<Mode>("quality");
  const [layer, setLayer] = useState<Layer>("mobility");
  const [viewFilter, setViewFilter] = useState<"both" | "front" | "back">("both");
  const [calibrating, setCalibrating] = useState(false);
  const [draft, setDraft] = useState<OverrideMap>({});

  const { overrides, isAdmin, saveAll, resetAll } = useBodyMapGeometry();

  const analysis = useMemo(() => {
    const base = analyze(metrics, layer, forcaExercises);
    if (layer === "strength" && forcaExercises && forcaExercises.length) {
      return applyForcaToRegions(base, forcaExercises);
    }
    return base;
  }, [metrics, layer, forcaExercises]);
  const risk = RISK_STYLE[analysis.riskLevel];

  const regionList = useMemo(() => buildRegionList(analysis, 6), [analysis]);
  const numbering = useMemo(() => {
    const m: Partial<Record<RegionId, number>> = {};
    regionList.forEach((it) => { m[it.id] = it.number; });
    return m;
  }, [regionList]);

  const mergedOverrides: OverrideMap = { ...overrides, ...draft };
  const hasDraft = Object.keys(draft).length > 0;

  function handleDrag(id: RegionId, cx: number, cy: number) {
    setDraft((d) => ({ ...d, [id]: { cx, cy } }));
  }

  async function handleSave() {
    try {
      await saveAll.mutateAsync(draft);
      setDraft({});
      toast.success("Posições salvas para todos.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    }
  }

  async function handleReset() {
    if (!confirm("Resetar todas as posições para o padrão do código? Esta ação remove os ajustes salvos.")) return;
    try {
      await resetAll.mutateAsync();
      setDraft({});
      toast.success("Posições resetadas.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao resetar.");
    }
  }


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

      {/* Controls row 1: modes + view filter */}
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

        <div className="flex items-center gap-3 flex-wrap">
          {/* Severity legend */}
          <div className="hidden md:flex items-center gap-2.5">
            {LEGEND.map(({ s, label }) => (
              <div key={s} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: `hsl(var(--sev-${s}))`,
                    boxShadow: `0 0 8px hsl(var(--sev-${s}) / 0.7)`,
                  }}
                />
                <span className="text-[10px] text-white/60">{label}</span>
              </div>
            ))}
          </div>

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

      {/* Calibration toolbar (admin) */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <Move className="w-3.5 h-3.5" />
            <span>
              {calibrating
                ? hasDraft
                  ? `Calibrando — ${Object.keys(draft).length} ponto(s) alterado(s)`
                  : "Calibrando — arraste os pontos sobre a imagem"
                : "Modo calibração disponível (admin)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {calibrating && hasDraft && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setDraft({})}>
                  <X className="w-3.5 h-3.5 mr-1" /> Descartar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saveAll.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {saveAll.isPending ? "Salvando..." : "Salvar para todos"}
                </Button>
              </>
            )}
            {calibrating && !hasDraft && Object.keys(overrides).length > 0 && (
              <Button size="sm" variant="ghost" onClick={handleReset} disabled={resetAll.isPending}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Resetar padrão
              </Button>
            )}
            <Button
              size="sm"
              variant={calibrating ? "secondary" : "outline"}
              onClick={() => { setCalibrating((v) => !v); setDraft({}); }}
            >
              {calibrating ? "Sair da calibração" : "Calibrar mapa"}
            </Button>
          </div>
        </div>
      )}

      {/* Main: SVG + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <BodyMapSVG
          analysis={analysis}
          mode={mode}
          overrides={mergedOverrides}
          calibrating={calibrating}
          onDragRegion={handleDrag}
          numbering={numbering}
          viewFilter={viewFilter}
        />

        {!calibrating && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-1">
              Pontos de atenção
            </p>
            <RegionListPanel items={regionList} />
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-[11px] text-white/40 leading-relaxed">
        As porcentagens representam a diferença do lado avaliado em relação ao lado mais forte ou ao valor de referência.
      </p>

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
