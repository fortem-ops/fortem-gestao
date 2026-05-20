import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BodyMapAnalysis, Mode, RegionId, Severity } from "./bodyMapLogic";
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL } from "./bodyMapLogic";
import { AnatomyFront } from "./anatomy/AnatomyFront";
import { AnatomyBack } from "./anatomy/AnatomyBack";

interface RegionGeometry {
  cx: number;
  cy: number;
  r: number;
  view: "front" | "back";
  label: string;
}

const VIEWBOX = { w: 200, h: 540 };

export const REGION_GEOMETRY: Record<RegionId, RegionGeometry> = {
  "shoulder-l":  { view: "front", cx: 58,  cy: 116, r: 22, label: "Ombro esquerdo (deltoide)" },
  "shoulder-r":  { view: "front", cx: 142, cy: 116, r: 22, label: "Ombro direito (deltoide)" },
  "thoracic":    { view: "back",  cx: 100, cy: 150, r: 32, label: "Coluna torácica" },
  "lumbar":      { view: "back",  cx: 100, cy: 232, r: 22, label: "Lombar" },
  "hip-l":       { view: "front", cx: 78,  cy: 260, r: 22, label: "Quadril esquerdo" },
  "hip-r":       { view: "front", cx: 122, cy: 260, r: 22, label: "Quadril direito" },
  "quad-l":      { view: "front", cx: 78,  cy: 350, r: 28, label: "Quadríceps / Psoas esquerdo" },
  "quad-r":      { view: "front", cx: 122, cy: 350, r: 28, label: "Quadríceps / Psoas direito" },
  "ham-l":       { view: "back",  cx: 76,  cy: 364, r: 28, label: "Posterior coxa esquerda" },
  "ham-r":       { view: "back",  cx: 124, cy: 364, r: 28, label: "Posterior coxa direita" },
  "ankle-l":     { view: "front", cx: 78,  cy: 506, r: 14, label: "Tornozelo esquerdo" },
  "ankle-r":     { view: "front", cx: 122, cy: 506, r: 14, label: "Tornozelo direito" },
};

interface Props {
  analysis: BodyMapAnalysis;
  mode: Mode;
}

function severityIntensity(s: Severity): { opacity: number; radiusMul: number } {
  switch (s) {
    case "excellent": return { opacity: 0.45, radiusMul: 0.9 };
    case "good":      return { opacity: 0.5,  radiusMul: 0.95 };
    case "medium":    return { opacity: 0.65, radiusMul: 1.05 };
    case "attention": return { opacity: 0.85, radiusMul: 1.2 };
    case "weak":      return { opacity: 1.0,  radiusMul: 1.35 };
    case "none":      return { opacity: 0.0,  radiusMul: 0.0 };
  }
}

function RegionGlow({
  id, geom, state, mode,
}: {
  id: RegionId;
  geom: RegionGeometry;
  state: BodyMapAnalysis["regions"][RegionId];
  mode: Mode;
}) {
  const { opacity, radiusMul } = severityIntensity(state.severity);
  const color = SEVERITY_COLOR_VAR[state.severity];
  const showHalo = state.severity !== "none" && (
    mode !== "asymmetry" || (state.asymmetry !== undefined && state.asymmetry >= 15)
  );
  const isPulsing = state.severity === "weak" || state.severity === "attention";
  const filterId = `glow-${id}`;
  const clipId = `clip-${id}`;
  const radius = geom.r * radiusMul;
  if (!showHalo) return null;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <use href={`#region-${id}`} />
        </clipPath>
        <radialGradient id={filterId} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor={`hsl(${color})`} stopOpacity={opacity} />
          <stop offset="55%" stopColor={`hsl(${color})`} stopOpacity={opacity * 0.55} />
          <stop offset="100%" stopColor={`hsl(${color})`} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Glow externo (não recortado) — irradia para fora do músculo */}
      <circle
        cx={geom.cx} cy={geom.cy} r={radius * 1.9}
        fill={`url(#${filterId})`}
        opacity={0.85}
        className={isPulsing ? "bodymap-pulse" : ""}
        pointerEvents="none"
      />
      {/* Preenchimento recortado pelo contorno do músculo (efeito Biomech) */}
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        <rect x={geom.cx - geom.r * 2} y={geom.cy - geom.r * 2}
              width={geom.r * 4} height={geom.r * 4}
              fill={`hsl(${color})`} opacity={opacity * 0.5} />
        <circle cx={geom.cx} cy={geom.cy} r={radius}
                fill={`url(#${filterId})`} opacity={1} />
      </g>
      {/* Contorno luminoso fino sobre o músculo */}
      <use href={`#region-${id}`} fill="none"
           stroke={`hsl(${color})`}
           strokeWidth={1.1} strokeOpacity={Math.min(0.95, opacity + 0.1)}
           pointerEvents="none" />
      {/* Núcleo brilhante */}
      <circle cx={geom.cx} cy={geom.cy} r={2.2}
              fill={`hsl(${color})`} opacity={0.95} pointerEvents="none" />
    </g>
  );
}

function RegionHit({
  id, geom, state,
}: {
  id: RegionId;
  geom: RegionGeometry;
  state: BodyMapAnalysis["regions"][RegionId];
}) {
  const color = SEVERITY_COLOR_VAR[state.severity];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g style={{ cursor: state.severity !== "none" ? "pointer" : "default" }}>
          <circle cx={geom.cx} cy={geom.cy} r={geom.r + 4} fill="transparent" />
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{geom.label}</p>
          {state.score !== null && (
            <p className="text-xs">
              Score:{" "}
              <span className="font-semibold" style={{ color: `hsl(${color})` }}>
                {state.score}/100
              </span>{" "}
              · {SEVERITY_LABEL[state.severity]}
            </p>
          )}
          {state.asymmetry !== undefined && state.asymmetry >= 15 && (
            <p className="text-[11px] text-warning">
              Assimetria {state.asymmetry >= 25 ? "severa" : "moderada"} ({state.asymmetry} pts)
            </p>
          )}
          {state.contributing.length > 0 && (
            <ul className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
              {state.contributing.slice(0, 4).map((c, i) => (
                <li key={i}>
                  {c.metric}{c.side !== "center" ? ` (${c.side === "left" ? "E" : "D"})` : ""}:{" "}
                  {c.value !== null ? `${c.value}°` : "—"} {c.classification ? `· ${c.classification}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function Chains({ analysis, view }: { analysis: BodyMapAnalysis; view: "front" | "back" }) {
  if (analysis.chains.length === 0) return null;
  return (
    <g>
      {analysis.chains.map((c, i) => {
        const a = REGION_GEOMETRY[c.from];
        const b = REGION_GEOMETRY[c.to];
        if (a.view !== view || b.view !== view) return null;
        return (
          <line key={i}
            x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
            stroke="hsl(var(--sev-attention))"
            strokeWidth={1.3}
            strokeDasharray="4 6"
            strokeOpacity={0.6}
            className="bodymap-chain"
          />
        );
      })}
    </g>
  );
}

export function BodyMapSVG({ analysis, mode }: Props) {
  return (
    <TooltipProvider delayDuration={120}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {(["front", "back"] as const).map((view) => {
          const regions = (Object.entries(REGION_GEOMETRY) as Array<[RegionId, RegionGeometry]>)
            .filter(([, g]) => g.view === view);
          return (
            <div key={view} className="flex flex-col items-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                {view === "front" ? "Vista anterior" : "Vista posterior"}
              </p>
              <svg
                viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
                className="w-full max-w-[260px] h-auto"
                role="img"
                aria-label={`Corpo humano — ${view === "front" ? "vista anterior" : "vista posterior"}`}
              >
                {/* Anatomia base */}
                {view === "front" ? <AnatomyFront /> : <AnatomyBack />}

                {/* Linhas de assimetria bilateral (modo assimetria) */}
                {mode === "asymmetry" && (
                  <g>
                    {analysis.asymmetries.map((a, i) => {
                      const id = a.region;
                      const opposite = id.endsWith("-l")
                        ? (id.replace("-l", "-r") as RegionId)
                        : (id.replace("-r", "-l") as RegionId);
                      const g1 = REGION_GEOMETRY[id];
                      const g2 = REGION_GEOMETRY[opposite];
                      if (!g1 || !g2 || g1.view !== view) return null;
                      return (
                        <line key={i}
                          x1={g1.cx} y1={g1.cy} x2={g2.cx} y2={g2.cy}
                          stroke={a.severity === "severe" ? "hsl(var(--sev-weak))" : "hsl(var(--sev-attention))"}
                          strokeWidth={1.2} strokeDasharray="3 4" strokeOpacity={0.7}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Cadeias compensatórias */}
                <Chains analysis={analysis} view={view} />

                {/* Halos + contornos luminosos por região */}
                {regions.map(([id, geom]) => (
                  <RegionGlow key={`glow-${id}`} id={id} geom={geom} state={analysis.regions[id]} mode={mode} />
                ))}

                {/* Hitboxes p/ tooltip — sempre por cima */}
                {regions.map(([id, geom]) => (
                  <RegionHit key={`hit-${id}`} id={id} geom={geom} state={analysis.regions[id]} />
                ))}
              </svg>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
