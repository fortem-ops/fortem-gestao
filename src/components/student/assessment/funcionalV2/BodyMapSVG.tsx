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

function MuscleShapeFill({ shape, fill, label }: { shape: BodyMapShape; fill: string; label?: string; instanceKey?: string }) {
  if (shape.points.length < 3) return null;
  const d = pointsToSmoothPath(shape.points);
  return (
    <path
      d={d}
      fill={fill}
      stroke="none"
      className={breatheClass(fill)}
    >
      {label && <title>{label}</title>}
    </path>
  );
}

function ArticulationShapeFill({ shape, fill, label }: { shape: BodyMapShape; fill: string; label: string; instanceKey?: string }) {
  if (shape.points.length < 3) return null;
  const d = pointsToSmoothPath(shape.points);
  return (
    <g className={breatheClass(fill)}>
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
          const min = Math.min(...values.map((x) => x.value));
          // Assimetria do PAR: ambos os lados recebem a mesma cor do gradiente.
          const pairAsymmetry = max > 0 && values.length > 1 ? ((max - min) / max) * 100 : 0;
          const pairFill = corGradienteAssimetria(pairAsymmetry);
          return values.flatMap((x) => {
            const shape = shapesMap[x.shapeKey];
            if (!shape) return [];
            const sideLabel = x.side === "Esquerdo" ? "Lado esquerdo" : x.side === "Direito" ? "Lado direito" : "Central";
            return [{ key: `mob:${m.metric}:${x.side}`, shape, fill: pairFill, label: `${m.metric} — ${sideLabel}: ${x.value}°`, articulation: true }];
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
          const labelBase = FORCA_EXERCICIO_LABEL[ex.nome as ForcaExercicio] ?? ex.nome;
          const out: Array<{ key: string; shape: BodyMapShape; fill: string; label: string }> = [];
          const shapeR = shapesMap[`${muscle}-direito`];
          const shapeL = shapesMap[`${muscle}-esquerdo`];
          if (shapeR) out.push({ key: `forca:${ex.nome}:direito`, shape: shapeR, fill: weakerIsRight ? riskColor : "#888780", label: `${labelBase} — Lado direito: ${ex.direito_kg!.toFixed(1)} kg` });
          if (shapeL) out.push({ key: `forca:${ex.nome}:esquerdo`, shape: shapeL, fill: !weakerIsRight ? riskColor : "#888780", label: `${labelBase} — Lado esquerdo: ${ex.esquerdo_kg!.toFixed(1)} kg` });
          return out;
        });
    }
    if (layer === "flexibility" && metrics) {
      return metrics
        .filter((m) => m.left !== null && m.right !== null && FLEXIBILIDADE_SHAPE_MUSCLE[m.metric])
        .flatMap((m) => {
          const muscle = FLEXIBILIDADE_SHAPE_MUSCLE[m.metric];
          const max = Math.max(m.left!, m.right!);
          const pairAsymmetry = max > 0 ? (Math.abs(m.left! - m.right!) / max) * 100 : 0;
          // Abaixo do limiar de atenção, mantém o neutro; com assimetria, AMBOS os lados
          // recebem a mesma cor do gradiente.
          const fill = pairAsymmetry >= 10 ? corGradienteAssimetria(pairAsymmetry) : "#7A8B99";
          const out: Array<{ key: string; shape: BodyMapShape; fill: string }> = [];
          const shapeR = shapesMap[`${muscle}-direito`];
          const shapeL = shapesMap[`${muscle}-esquerdo`];
          if (shapeR) out.push({ key: `flex:${m.metric}:direito`, shape: shapeR, fill });
          if (shapeL) out.push({ key: `flex:${m.metric}:esquerdo`, shape: shapeL, fill });
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

