import { useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BodyMapAnalysis, Mode, RegionId, Severity } from "./bodyMapLogic";
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL } from "./bodyMapLogic";
import { AnatomyFront } from "./anatomy/AnatomyFront";
import { AnatomyBack } from "./anatomy/AnatomyBack";
import type { OverrideMap } from "./useBodyMapGeometry";

interface RegionGeometry {
  cx: number;
  cy: number;
  r: number;
  view: "front" | "back";
  label: string;
}

const VIEWBOX = { w: 360, h: 800 };

// Coordenadas calibradas para a imagem anatômica (360×800, com 30px de padding lateral).
// Convenção: "-l" = lado esquerdo do aluno (à direita do espectador na vista anterior,
// à esquerda do espectador na vista posterior).
export const REGION_GEOMETRY: Record<RegionId, RegionGeometry> = {
  "shoulder-l":  { view: "front", cx: 240, cy: 205, r: 32, label: "Ombro esquerdo (deltoide)" },
  "shoulder-r":  { view: "front", cx: 125, cy: 205, r: 32, label: "Ombro direito (deltoide)" },
  "thoracic":    { view: "back",  cx: 180, cy: 260, r: 46, label: "Coluna torácica" },
  "lumbar":      { view: "back",  cx: 180, cy: 390, r: 34, label: "Lombar" },
  "hip-l":       { view: "front", cx: 220, cy: 410, r: 30, label: "Quadril esquerdo" },
  "hip-r":       { view: "front", cx: 145, cy: 410, r: 30, label: "Quadril direito" },
  "quad-l":      { view: "front", cx: 225, cy: 520, r: 36, label: "Quadríceps / Psoas esquerdo" },
  "quad-r":      { view: "front", cx: 140, cy: 520, r: 36, label: "Quadríceps / Psoas direito" },
  "ham-l":       { view: "back",  cx: 145, cy: 555, r: 36, label: "Posterior coxa esquerda" },
  "ham-r":       { view: "back",  cx: 225, cy: 555, r: 36, label: "Posterior coxa direita" },
  "ankle-l":     { view: "front", cx: 215, cy: 755, r: 20, label: "Tornozelo esquerdo" },
  "ankle-r":     { view: "front", cx: 155, cy: 755, r: 20, label: "Tornozelo direito" },
};

interface Props {
  analysis: BodyMapAnalysis;
  mode: Mode;
  overrides?: OverrideMap;
  calibrating?: boolean;
  onDragRegion?: (id: RegionId, cx: number, cy: number) => void;
}

function mergeGeometry(overrides?: OverrideMap): Record<RegionId, RegionGeometry> {
  if (!overrides) return REGION_GEOMETRY;
  const out = { ...REGION_GEOMETRY };
  (Object.keys(overrides) as RegionId[]).forEach((id) => {
    const o = overrides[id];
    if (o && out[id]) out[id] = { ...out[id], cx: o.cx, cy: o.cy };
  });
  return out;
}

function severityIntensity(s: Severity): { opacity: number; radiusMul: number } {
  switch (s) {
    case "excellent": return { opacity: 0.55, radiusMul: 0.95 };
    case "good":      return { opacity: 0.6,  radiusMul: 1.0 };
    case "medium":    return { opacity: 0.75, radiusMul: 1.1 };
    case "attention": return { opacity: 0.9,  radiusMul: 1.25 };
    case "weak":      return { opacity: 1.0,  radiusMul: 1.4 };
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
  const gradId = `glow-${id}`;
  const radius = geom.r * radiusMul;
  if (!showHalo) return null;

  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={gradId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={`hsl(${color})`} stopOpacity={opacity} />
          <stop offset="55%" stopColor={`hsl(${color})`} stopOpacity={opacity * 0.45} />
          <stop offset="100%" stopColor={`hsl(${color})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Halo externo amplo (irradiação) */}
      <circle
        cx={geom.cx} cy={geom.cy} r={radius * 2.1}
        fill={`url(#${gradId})`}
        opacity={0.85}
        className={isPulsing ? "bodymap-pulse" : ""}
      />
      {/* Halo interno mais denso (luz central) */}
      <circle
        cx={geom.cx} cy={geom.cy} r={radius * 1.1}
        fill={`url(#${gradId})`}
        opacity={1}
        style={{ mixBlendMode: "screen" }}
      />
      {/* Anel luminoso fino */}
      <circle
        cx={geom.cx} cy={geom.cy} r={radius}
        fill="none"
        stroke={`hsl(${color})`}
        strokeWidth={1.4}
        strokeOpacity={Math.min(0.95, opacity + 0.1)}
        style={{ mixBlendMode: "screen" }}
      />
      {/* Núcleo brilhante */}
      <circle cx={geom.cx} cy={geom.cy} r={3} fill={`hsl(${color})`} opacity={0.95} />
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
          <circle cx={geom.cx} cy={geom.cy} r={geom.r + 6} fill="transparent" />
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

function Chains({
  analysis, view, geometry,
}: { analysis: BodyMapAnalysis; view: "front" | "back"; geometry: Record<RegionId, RegionGeometry> }) {
  if (analysis.chains.length === 0) return null;
  return (
    <g pointerEvents="none">
      {analysis.chains.map((c, i) => {
        const a = geometry[c.from];
        const b = geometry[c.to];
        if (a.view !== view || b.view !== view) return null;
        return (
          <line key={i}
            x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
            stroke="hsl(var(--sev-attention))"
            strokeWidth={1.6}
            strokeDasharray="5 7"
            strokeOpacity={0.7}
            className="bodymap-chain"
          />
        );
      })}
    </g>
  );
}

function CalibrationHandle({
  id, geom, svgRef, onDrag,
}: {
  id: RegionId;
  geom: RegionGeometry;
  svgRef: React.RefObject<SVGSVGElement>;
  onDrag: (id: RegionId, cx: number, cy: number) => void;
}) {
  const draggingRef = useRef(false);

  function toViewBox(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEWBOX.w;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX.h;
    return {
      x: Math.max(0, Math.min(VIEWBOX.w, x)),
      y: Math.max(0, Math.min(VIEWBOX.h, y)),
    };
  }

  return (
    <g
      style={{ cursor: "move" }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        draggingRef.current = true;
        e.stopPropagation();
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const p = toViewBox(e.clientX, e.clientY);
        if (p) onDrag(id, Math.round(p.x), Math.round(p.y));
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
      }}
    >
      {/* hit area */}
      <circle cx={geom.cx} cy={geom.cy} r={geom.r + 4} fill="hsl(0 0% 100% / 0.06)" stroke="hsl(0 0% 100% / 0.9)" strokeWidth={1.5} strokeDasharray="3 3" />
      <circle cx={geom.cx} cy={geom.cy} r={4} fill="hsl(140 80% 55%)" stroke="white" strokeWidth={1.2} />
      <text x={geom.cx} y={geom.cy - geom.r - 8} textAnchor="middle"
        fontSize={9} fill="white" style={{ pointerEvents: "none", fontFamily: "monospace" }}>
        {id}
      </text>
    </g>
  );
}

export function BodyMapSVG({ analysis, mode, overrides, calibrating, onDragRegion }: Props) {
  const geometry = mergeGeometry(overrides);
  const frontSvgRef = useRef<SVGSVGElement>(null);
  const backSvgRef = useRef<SVGSVGElement>(null);

  return (
    <TooltipProvider delayDuration={120}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {(["front", "back"] as const).map((view) => {
          const regions = (Object.entries(geometry) as Array<[RegionId, RegionGeometry]>)
            .filter(([, g]) => g.view === view);
          const svgRef = view === "front" ? frontSvgRef : backSvgRef;
          return (
            <div key={view} className="flex flex-col items-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                {view === "front" ? "Vista anterior" : "Vista posterior"}
              </p>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
                className="w-full max-w-[360px] h-auto rounded-xl overflow-hidden"
                role="img"
                aria-label={`Corpo humano — ${view === "front" ? "vista anterior" : "vista posterior"}`}
                style={{ touchAction: calibrating ? "none" : undefined }}
              >
                {view === "front" ? <AnatomyFront /> : <AnatomyBack />}

                {mode === "asymmetry" && !calibrating && (
                  <g pointerEvents="none">
                    {analysis.asymmetries.map((a, i) => {
                      const id = a.region;
                      const opposite = id.endsWith("-l")
                        ? (id.replace("-l", "-r") as RegionId)
                        : (id.replace("-r", "-l") as RegionId);
                      const g1 = geometry[id];
                      const g2 = geometry[opposite];
                      if (!g1 || !g2 || g1.view !== view) return null;
                      return (
                        <line key={i}
                          x1={g1.cx} y1={g1.cy} x2={g2.cx} y2={g2.cy}
                          stroke={a.severity === "severe" ? "hsl(var(--sev-weak))" : "hsl(var(--sev-attention))"}
                          strokeWidth={1.5} strokeDasharray="4 5" strokeOpacity={0.75}
                        />
                      );
                    })}
                  </g>
                )}

                {!calibrating && <Chains analysis={analysis} view={view} geometry={geometry} />}

                {!calibrating && regions.map(([id, geom]) => (
                  <RegionGlow key={`glow-${id}`} id={id} geom={geom} state={analysis.regions[id]} mode={mode} />
                ))}

                {!calibrating && regions.map(([id, geom]) => (
                  <RegionHit key={`hit-${id}`} id={id} geom={geom} state={analysis.regions[id]} />
                ))}

                {calibrating && onDragRegion && regions.map(([id, geom]) => (
                  <CalibrationHandle key={`cal-${id}`} id={id} geom={geom} svgRef={svgRef} onDrag={onDragRegion} />
                ))}
              </svg>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
