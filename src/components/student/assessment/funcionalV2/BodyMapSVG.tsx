import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BodyMapAnalysis, Mode, RegionId, Severity } from "./bodyMapLogic";
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL } from "./bodyMapLogic";

interface RegionGeometry {
  /** Center for halo + tooltip anchor */
  cx: number;
  cy: number;
  /** Halo radius (max) */
  r: number;
  view: "front" | "back";
  label: string;
}

const FRONT_VIEWBOX = { w: 200, h: 540 };
const BACK_VIEWBOX = { w: 200, h: 540 };

// Geometry shared across views — front uses x as-is; back mirrors anatomically.
export const REGION_GEOMETRY: Record<RegionId, RegionGeometry> = {
  "shoulder-l":  { view: "front", cx: 60,  cy: 108, r: 22, label: "Ombro esquerdo" },
  "shoulder-r":  { view: "front", cx: 140, cy: 108, r: 22, label: "Ombro direito" },
  "thoracic":    { view: "back",  cx: 100, cy: 175, r: 32, label: "Coluna torácica" },
  "lumbar":      { view: "back",  cx: 100, cy: 245, r: 22, label: "Lombar" },
  "hip-l":       { view: "front", cx: 78,  cy: 290, r: 22, label: "Quadril esquerdo" },
  "hip-r":       { view: "front", cx: 122, cy: 290, r: 22, label: "Quadril direito" },
  "quad-l":      { view: "front", cx: 78,  cy: 365, r: 26, label: "Quadríceps / Psoas esquerdo" },
  "quad-r":      { view: "front", cx: 122, cy: 365, r: 26, label: "Quadríceps / Psoas direito" },
  "ham-l":       { view: "back",  cx: 78,  cy: 365, r: 26, label: "Posterior coxa esquerda" },
  "ham-r":       { view: "back",  cx: 122, cy: 365, r: 26, label: "Posterior coxa direita" },
  "ankle-l":     { view: "front", cx: 78,  cy: 500, r: 18, label: "Tornozelo esquerdo" },
  "ankle-r":     { view: "front", cx: 122, cy: 500, r: 18, label: "Tornozelo direito" },
};

interface Props {
  analysis: BodyMapAnalysis;
  mode: Mode;
}

function severityIntensity(s: Severity): { opacity: number; radiusMul: number } {
  switch (s) {
    case "excellent": return { opacity: 0.35, radiusMul: 0.85 };
    case "good":      return { opacity: 0.35, radiusMul: 0.9 };
    case "medium":    return { opacity: 0.5,  radiusMul: 1.0 };
    case "attention": return { opacity: 0.7,  radiusMul: 1.15 };
    case "weak":      return { opacity: 0.95, radiusMul: 1.3 };
    case "none":      return { opacity: 0.0,  radiusMul: 0.0 };
  }
}

function HumanSilhouette({ view }: { view: "front" | "back" }) {
  // Stylized clean anatomical silhouette built from primitives — gives clear regions to overlay.
  return (
    <g className="bodymap-silhouette-stroke bodymap-silhouette-fill" strokeWidth={1.2}>
      {/* Head */}
      <ellipse cx={100} cy={48} rx={26} ry={32} />
      {/* Neck */}
      <path d="M88,76 L88,92 Q100,98 112,92 L112,76 Z" />
      {/* Torso */}
      <path d="M55,98 Q62,92 78,94 L122,94 Q138,92 145,98 L150,160 Q150,200 144,228 L138,268 L62,268 L56,228 Q50,200 50,160 Z" />
      {/* Arms */}
      <path d="M48,108 Q34,118 32,150 L34,210 Q36,238 42,260 L52,258 L54,210 L56,160 Z" />
      <path d="M152,108 Q166,118 168,150 L166,210 Q164,238 158,260 L148,258 L146,210 L144,160 Z" />
      {/* Forearms */}
      <path d="M34,258 Q30,300 36,340 L46,338 L48,300 L50,262 Z" />
      <path d="M166,258 Q170,300 164,340 L154,338 L152,300 L150,262 Z" />
      {/* Pelvis */}
      <path d="M62,268 L138,268 L142,310 Q120,322 100,322 Q80,322 58,310 Z" />
      {/* Thighs */}
      <path d="M62,310 Q56,360 60,420 L92,420 Q96,360 92,310 Z" />
      <path d="M138,310 Q144,360 140,420 L108,420 Q104,360 108,310 Z" />
      {/* Knees */}
      <ellipse cx={78} cy={428} rx={16} ry={8} />
      <ellipse cx={122} cy={428} rx={16} ry={8} />
      {/* Shins */}
      <path d="M64,438 Q60,478 66,510 L90,510 Q92,478 92,438 Z" />
      <path d="M136,438 Q140,478 134,510 L110,510 Q108,478 108,438 Z" />
      {/* Feet */}
      <path d="M62,510 L92,510 L94,524 Q78,532 60,524 Z" />
      <path d="M138,510 L108,510 L106,524 Q122,532 140,524 Z" />
      {/* Back-only midline */}
      {view === "back" && (
        <line x1={100} y1={98} x2={100} y2={268} strokeDasharray="2 4" strokeOpacity={0.5} />
      )}
    </g>
  );
}

function Region({
  id, geom, state, mode,
}: {
  id: RegionId;
  geom: RegionGeometry;
  state: BodyMapAnalysis["regions"][RegionId];
  mode: Mode;
}) {
  const { opacity, radiusMul } = severityIntensity(state.severity);
  const color = SEVERITY_COLOR_VAR[state.severity];

  // In asymmetry mode, only the worst side of an asymmetric pair lights up strongly
  const showHalo = state.severity !== "none" && (
    mode !== "asymmetry" || (state.asymmetry !== undefined && state.asymmetry >= 15)
  );
  const isPulsing = state.severity === "weak" || state.severity === "attention";

  const tooltipLabel = `${geom.label} · ${SEVERITY_LABEL[state.severity]}${
    state.score !== null ? ` (${state.score}/100)` : ""
  }`;

  const filterId = `glow-${id}`;
  const radius = geom.r * radiusMul;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g style={{ cursor: state.severity !== "none" ? "pointer" : "default" }}>
          {/* Hitbox */}
          <circle cx={geom.cx} cy={geom.cy} r={geom.r + 6} fill="transparent" />
          {showHalo && (
            <>
              <defs>
                <radialGradient id={filterId}>
                  <stop offset="0%" stopColor={`hsl(${color})`} stopOpacity={opacity} />
                  <stop offset="60%" stopColor={`hsl(${color})`} stopOpacity={opacity * 0.4} />
                  <stop offset="100%" stopColor={`hsl(${color})`} stopOpacity={0} />
                </radialGradient>
              </defs>
              <circle
                cx={geom.cx} cy={geom.cy} r={radius * 1.8}
                fill={`url(#${filterId})`}
                className={isPulsing ? "bodymap-pulse" : ""}
              />
              <circle
                cx={geom.cx} cy={geom.cy} r={Math.max(3, geom.r * 0.18)}
                fill={`hsl(${color})`} opacity={0.95}
              />
            </>
          )}
          {/* Always show subtle joint dot for orientation */}
          {!showHalo && state.severity === "none" && (
            <circle cx={geom.cx} cy={geom.cy} r={2} fill="hsl(var(--bodymap-silhouette) / 0.35)" />
          )}
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
          <line
            key={i}
            x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
            stroke="hsl(var(--sev-attention))"
            strokeWidth={1.4}
            strokeDasharray="4 6"
            strokeOpacity={0.65}
            className="bodymap-chain"
          />
        );
      })}
    </g>
  );
}

function AsymmetryLinks({ analysis }: { analysis: BodyMapAnalysis }) {
  return (
    <>
      {analysis.asymmetries.map((a, i) => {
        const id = a.region;
        const opposite = id.endsWith("-l")
          ? (id.replace("-l", "-r") as RegionId)
          : (id.replace("-r", "-l") as RegionId);
        const g1 = REGION_GEOMETRY[id];
        const g2 = REGION_GEOMETRY[opposite];
        if (!g1 || !g2 || g1.view !== g2.view) return null;
        return (
          <line
            key={i}
            x1={g1.cx} y1={g1.cy} x2={g2.cx} y2={g2.cy}
            stroke={a.severity === "severe" ? "hsl(var(--sev-weak))" : "hsl(var(--sev-attention))"}
            strokeWidth={1.2}
            strokeDasharray="3 4"
            strokeOpacity={0.7}
            data-view={g1.view}
          />
        );
      })}
    </>
  );
}

export function BodyMapSVG({ analysis, mode }: Props) {
  const frontRegions = Object.entries(REGION_GEOMETRY).filter(([,g]) => g.view === "front") as Array<[RegionId, RegionGeometry]>;
  const backRegions = Object.entries(REGION_GEOMETRY).filter(([,g]) => g.view === "back") as Array<[RegionId, RegionGeometry]>;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {(["front","back"] as const).map((view) => {
          const regions = view === "front" ? frontRegions : backRegions;
          const otherRegions = view === "front"
            ? Object.entries(REGION_GEOMETRY).filter(([id, g]) => g.view !== view && (id === "shoulder-l" || id === "shoulder-r" || id === "hip-l" || id === "hip-r"))
            : [];
          return (
            <div key={view} className="flex flex-col items-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                {view === "front" ? "Vista anterior" : "Vista posterior"}
              </p>
              <svg
                viewBox={`0 0 ${FRONT_VIEWBOX.w} ${FRONT_VIEWBOX.h}`}
                className="w-full max-w-[260px] h-auto"
                role="img"
                aria-label={`Corpo humano — ${view === "front" ? "vista anterior" : "vista posterior"}`}
              >
                <HumanSilhouette view={view} />
                {mode === "asymmetry" && (
                  <g>
                    {analysis.asymmetries.map((a, i) => {
                      const id = a.region;
                      const opposite = id.endsWith("-l")
                        ? (id.replace("-l","-r") as RegionId)
                        : (id.replace("-r","-l") as RegionId);
                      const g1 = REGION_GEOMETRY[id];
                      const g2 = REGION_GEOMETRY[opposite];
                      if (g1.view !== view) return null;
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
                <Chains analysis={analysis} view={view} />
                {regions.map(([id, geom]) => (
                  <Region key={id} id={id} geom={geom} state={analysis.regions[id]} mode={mode} />
                ))}
              </svg>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
