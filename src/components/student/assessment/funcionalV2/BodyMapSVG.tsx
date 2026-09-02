import { corGradienteAssimetria } from "./bodyMapLogic";
import { AnatomyFront } from "./anatomy/AnatomyFront";
import { AnatomyBack } from "./anatomy/AnatomyBack";
import { pointsToSmoothPath } from "./pointsToPath";
import { FORCA_SHAPE_MUSCLE, FLEXIBILIDADE_SHAPE_MUSCLE, MOBILIDADE_SHAPE_ARTICULATION } from "./shapeMuscleMapping";
import { classifyForca, type ForcaInput, type Layer, type MetricInput } from "./bodyMapLogic";
import type { BodyMapShape } from "./useBodyMapShapes";

const VIEWBOX = { w: 1024, h: 1024 };

type ShapeInstance = {
  key: string;
  shape: BodyMapShape;
  fill: string;
  label?: string;
  articulation?: boolean;
};

interface Props {
  /** Filter which view(s) to render */
  viewFilter?: "front" | "back" | "both";
  /** Formas musculares de Força/Flexibilidade e articulares de Mobilidade. */
  layer?: Layer;
  forcaExercises?: ForcaInput[];
  metrics?: MetricInput[];
  shapesMap?: Record<string, BodyMapShape>;
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
  viewFilter = "both",
  layer, forcaExercises, metrics, shapesMap,
}: Props) {

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

