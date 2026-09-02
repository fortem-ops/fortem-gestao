import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BodyMapAnalysis, Mode, RegionId } from "./bodyMapLogic";
import { corGradienteAssimetria } from "./bodyMapLogic";
import { AnatomyFront } from "./anatomy/AnatomyFront";
import { AnatomyBack } from "./anatomy/AnatomyBack";
import type { OverrideMap } from "./useBodyMapGeometry";
import { pointsToSmoothPath } from "./pointsToPath";
import { FORCA_SHAPE_MUSCLE, FLEXIBILIDADE_SHAPE_MUSCLE, MOBILIDADE_SHAPE_ARTICULATION } from "./shapeMuscleMapping";
import { classifyForca, type ForcaInput, type Layer, type MetricInput } from "./bodyMapLogic";
import type { BodyMapShape } from "./useBodyMapShapes";

interface RegionGeometry {
  cx: number;
  cy: number;
  r: number;
  view: "front" | "back";
  label: string;
}

const VIEWBOX = { w: 1024, h: 1024 };

// Coordenadas calibradas para o asset anatômico 1024×1024 (mãos completas, corpo centralizado).
// Convenção: "-l" = lado esquerdo do aluno
// (à direita do espectador na vista anterior; à esquerda do espectador na vista posterior).
export const REGION_GEOMETRY: Record<RegionId, RegionGeometry> = {
  "shoulder-l":     { view: "front", cx: 625, cy: 255, r: 65, label: "Ombro esquerdo (deltoide)" },
  "shoulder-r":     { view: "front", cx: 400, cy: 255, r: 65, label: "Ombro direito (deltoide)" },
  "shoulder-re-l":  { view: "back",  cx: 625, cy: 265, r: 55, label: "Ombro esquerdo — RE (manguito posterior)" },
  "shoulder-re-r":  { view: "back",  cx: 400, cy: 265, r: 55, label: "Ombro direito — RE (manguito posterior)" },
  "elbow-l":        { view: "front", cx: 655, cy: 420, r: 42, label: "Cotovelo esquerdo" },
  "elbow-r":        { view: "front", cx: 370, cy: 420, r: 42, label: "Cotovelo direito" },
  "wrist-l":        { view: "front", cx: 680, cy: 560, r: 32, label: "Punho esquerdo" },
  "wrist-r":        { view: "front", cx: 345, cy: 560, r: 32, label: "Punho direito" },
  "thoracic":       { view: "back",  cx: 512, cy: 300, r: 90, label: "Coluna torácica" },
  "lumbar":         { view: "back",  cx: 512, cy: 480, r: 70, label: "Lombar" },
  "hip-l":          { view: "front", cx: 560, cy: 545, r: 55, label: "Quadril esquerdo" },
  "hip-r":          { view: "front", cx: 465, cy: 545, r: 55, label: "Quadril direito" },
  "hip-re-l":       { view: "back",  cx: 575, cy: 555, r: 55, label: "Quadril esquerdo — RE (glúteo/rotadores)" },
  "hip-re-r":       { view: "back",  cx: 450, cy: 555, r: 55, label: "Quadril direito — RE (glúteo/rotadores)" },
  "psoas-l":        { view: "front", cx: 560, cy: 600, r: 50, label: "Psoas esquerdo (flexor de quadril)" },
  "psoas-r":        { view: "front", cx: 465, cy: 600, r: 50, label: "Psoas direito (flexor de quadril)" },
  "quad-l":         { view: "front", cx: 570, cy: 720, r: 65, label: "Quadríceps esquerdo" },
  "quad-r":         { view: "front", cx: 455, cy: 720, r: 65, label: "Quadríceps direito" },
  "ham-l":          { view: "back",  cx: 450, cy: 720, r: 70, label: "Posterior coxa esquerda" },
  "ham-r":          { view: "back",  cx: 570, cy: 720, r: 70, label: "Posterior coxa direita" },
  "ankle-l":        { view: "front", cx: 560, cy: 985, r: 38, label: "Tornozelo esquerdo" },
  "ankle-r":        { view: "front", cx: 465, cy: 985, r: 38, label: "Tornozelo direito" },
};

type ShapeInstance = {
  key: string;
  shape: BodyMapShape;
  fill: string;
  label?: string;
  articulation?: boolean;
};

interface Props {
  analysis: BodyMapAnalysis;
  mode: Mode;
  overrides?: OverrideMap;
  /** Maps regionId → display number for the side panel sync */
  numbering?: Partial<Record<RegionId, number>>;
  /** Filter which view(s) to render */
  viewFilter?: "front" | "back" | "both";
  /** Formas musculares de Força/Flexibilidade e articulares de Mobilidade. */
  layer?: Layer;
  forcaExercises?: ForcaInput[];
  metrics?: MetricInput[];
  shapesMap?: Record<string, BodyMapShape>;
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

function RegionGlow({
  id, geom, state, mode,
}: {
  id: RegionId;
  geom: RegionGeometry;
  state: BodyMapAnalysis["regions"][RegionId];
  mode: Mode;
}) {
  const hasAsym = state.asymmetry !== undefined && state.asymmetry !== null;
  const color = hasAsym ? corGradienteAssimetria(state.asymmetry!) : null;
  const showHalo = hasAsym && state.asymmetry! > 0;
  const isPulsing = hasAsym && state.asymmetry! > 20;
  const gradId = `glow-${id}`;
  if (!showHalo || !color) return null;

  // Halo minimalista: leve brilho difuso atrás do marcador numerado.
  // Intensidade proporcional ao % de assimetria (gradiente contínuo).
  const r = 26;
  const intensity = Math.min(1, state.asymmetry! / 25);
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={gradId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={color} stopOpacity={0.2 + 0.35 * intensity} />
          <stop offset="70%" stopColor={color} stopOpacity={0.06 + 0.12 * intensity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle
        cx={geom.cx} cy={geom.cy} r={r * 1.8}
        fill={`url(#${gradId})`}
        className={isPulsing ? "bodymap-pulse" : ""}
      />
    </g>
  );
}


function RegionNumber({
  geom, state, number,
}: {
  geom: RegionGeometry;
  state: BodyMapAnalysis["regions"][RegionId];
  number: number;
}) {
  const color = corGradienteAssimetria(state.asymmetry ?? null);
  return (
    <g pointerEvents="none">
      <circle
        cx={geom.cx} cy={geom.cy} r={16}
        fill={color}
        stroke="hsl(220 13% 9%)"
        strokeWidth={2}
      />
      <text
        x={geom.cx} y={geom.cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fontWeight={700}
        fill="hsl(220 13% 9%)"
        style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
      >
        {number}
      </text>
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
  const hasAsym = state.asymmetry !== undefined && state.asymmetry !== null;
  const color = corGradienteAssimetria(state.asymmetry ?? null);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g style={{ cursor: hasAsym || state.score !== null ? "pointer" : "default" }}>
          <circle cx={geom.cx} cy={geom.cy} r={geom.r + 6} fill="transparent" />
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <div className="space-y-1">
          <p className="font-semibold text-xs">{geom.label}</p>
          {hasAsym && (
            <p className="text-xs">
              Assimetria:{" "}
              <span className="font-semibold" style={{ color }}>
                {Math.round(state.asymmetry! * 10) / 10}%
              </span>
            </p>
          )}

          {state.contributing.length > 0 && (
            <ul className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
              {state.contributing.slice(0, 4).map((c, i) => (
                <li key={i}>
                  {c.metric}{c.side !== "center" ? ` (${c.side === "left" ? "E" : "D"})` : ""}:{" "}
                  {c.value !== null ? `${c.value}°` : "—"}

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
            strokeWidth={2.4}
            strokeDasharray="8 10"
            strokeOpacity={0.7}
            className="bodymap-chain"
          />
        );
      })}
    </g>
  );
}

const NEUTRAL_FILLS = new Set(["#888780", "#7A8B99"]);

function breatheClass(fill: string) {
  return NEUTRAL_FILLS.has(fill)
    ? "bodymap-breathe bodymap-breathe-soft"
    : "bodymap-breathe bodymap-breathe-strong";
}

function breatheDelay(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 32;
  return `${((h / 32) * 1.6).toFixed(2)}s`;
}

function MuscleShapeFill({ shape, fill, instanceKey }: { shape: BodyMapShape; fill: string; instanceKey: string }) {
  if (shape.points.length < 3) return null;
  const d = pointsToSmoothPath(shape.points);
  return (
    <path
      d={d}
      fill={fill}
      stroke="none"
      className={breatheClass(fill)}
      style={{ animationDelay: breatheDelay(instanceKey) }}
    />
  );
}

function ArticulationShapeFill({ shape, fill, label, instanceKey }: { shape: BodyMapShape; fill: string; label: string; instanceKey: string }) {
  if (shape.points.length < 3) return null;
  const d = pointsToSmoothPath(shape.points);
  return (
    <g className={breatheClass(fill)} style={{ animationDelay: breatheDelay(instanceKey) }}>
      <path d={d} fill={fill} stroke={fill} strokeOpacity={0.95} strokeWidth={3} />
      <title>{label}</title>
    </g>
  );
}


export function BodyMapSVG({
  analysis, mode, overrides, numbering, viewFilter = "both",
  layer, forcaExercises, metrics, shapesMap,
}: Props) {
  const geometry = mergeGeometry(overrides);

  const shapeInstances: ShapeInstance[] = (() => {
    if (!shapesMap) return [];
    if (layer === "mobility" && metrics) {
      return metrics
        .filter((m) => m.left !== null || m.right !== null)
        .flatMap((m) => {
          const mapping = MOBILIDADE_SHAPE_ARTICULATION[m.metric];
          if (!mapping) return [];
          const values = [
            mapping.left && m.left !== null ? { shapeKey: mapping.left, value: m.left, side: "Esquerdo" } : null,
            mapping.right && m.right !== null ? { shapeKey: mapping.right, value: m.right, side: "Direito" } : null,
            mapping.center && (m.left !== null || m.right !== null) ? { shapeKey: mapping.center, value: m.left ?? m.right, side: "Central" } : null,
          ].filter((x): x is { shapeKey: string; value: number; side: string } => x !== null);
          const max = Math.max(...values.map((x) => x.value), 0);
          return values.flatMap((x) => {
            const shape = shapesMap[x.shapeKey];
            if (!shape) return [];
            const asymmetry = max > 0 && values.length > 1 ? (Math.abs(max - x.value) / max) * 100 : 0;
            return [{ key: `mob:${m.metric}:${x.side}`, shape, fill: corGradienteAssimetria(asymmetry), label: `${m.metric} — ${x.side}: ${x.value}°`, articulation: true }];
          });
        });
    }
    if (layer === "strength" && forcaExercises) {
      return forcaExercises
        .filter((ex) => ex.direito_kg != null && ex.esquerdo_kg != null)
        .flatMap((ex) => {
          const muscle = FORCA_SHAPE_MUSCLE[ex.nome];
          if (!muscle) return [];
          const { assimetria } = classifyForca(ex.direito_kg!, ex.esquerdo_kg!);
          const weakerIsRight = ex.direito_kg! < ex.esquerdo_kg!;
          const riskColor = corGradienteAssimetria(assimetria);
          const out: Array<{ key: string; shape: BodyMapShape; fill: string }> = [];
          const shapeR = shapesMap[`${muscle}-direito`];
          const shapeL = shapesMap[`${muscle}-esquerdo`];
          if (shapeR) out.push({ key: `forca:${ex.nome}:direito`, shape: shapeR, fill: weakerIsRight ? riskColor : "#888780" });
          if (shapeL) out.push({ key: `forca:${ex.nome}:esquerdo`, shape: shapeL, fill: !weakerIsRight ? riskColor : "#888780" });
          return out;
        });
    }
    if (layer === "flexibility" && metrics) {
      return metrics
        .filter((m) => m.left !== null && m.right !== null && FLEXIBILIDADE_SHAPE_MUSCLE[m.metric])
        .flatMap((m) => {
          const muscle = FLEXIBILIDADE_SHAPE_MUSCLE[m.metric];
          const out: Array<{ key: string; shape: BodyMapShape; fill: string }> = [];
          const shapeR = shapesMap[`${muscle}-direito`];
          const shapeL = shapesMap[`${muscle}-esquerdo`];
          if (shapeR) out.push({ key: `flex:${m.metric}:direito`, shape: shapeR, fill: "#7A8B99" });
          if (shapeL) out.push({ key: `flex:${m.metric}:esquerdo`, shape: shapeL, fill: "#7A8B99" });
          return out;
        });
    }
    return [];
  })();

  const views = viewFilter === "both" ? (["front", "back"] as const) : ([viewFilter] as const);
  const gridCols = views.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";

  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-3 w-full`}>
      {views.map((view) => (
        <div key={view} className="flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
            {view === "front" ? "Vista anterior" : "Vista posterior"}
          </p>
          <svg
            viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
            className="w-full max-w-[420px] h-auto rounded-xl overflow-hidden"
            role="img"
            aria-label={`Corpo humano — ${view === "front" ? "vista anterior" : "vista posterior"}`}
          >
            {view === "front" ? <AnatomyFront /> : <AnatomyBack />}

            {shapeInstances
              .filter((s) => s.shape.view === view)
              .map((s) => s.articulation
                ? <ArticulationShapeFill key={s.key} instanceKey={s.key} shape={s.shape} fill={s.fill} label={s.label ?? "Articulação"} />
                : <MuscleShapeFill key={s.key} instanceKey={s.key} shape={s.shape} fill={s.fill} />
              )}
          </svg>
        </div>
      ))}
    </div>
  );
}

