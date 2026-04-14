import { useMemo } from "react";
import type { AssessmentClassification } from "@/lib/mock-data";
import corpoHumano from "@/assets/corpo-humano.svg";

interface BodyDiagramProps {
  classifications: Record<string, { left: AssessmentClassification | null; right: AssessmentClassification | null }>;
}

const classificationFill: Record<string, string> = {
  Fraco: "hsl(0, 72%, 51%)",
  Regular: "hsl(45, 93%, 47%)",
  Médio: "hsl(213, 94%, 56%)",
  Bom: "hsl(142, 71%, 45%)",
  Excelente: "hsl(142, 71%, 55%)",
};

function getFill(c: AssessmentClassification | null): string | null {
  return c ? classificationFill[c] || null : null;
}

function avgClassification(a: AssessmentClassification | null, b: AssessmentClassification | null): AssessmentClassification | null {
  if (a && b) {
    const order: AssessmentClassification[] = ["Fraco", "Regular", "Médio", "Bom", "Excelente"];
    return order[Math.round((order.indexOf(a) + order.indexOf(b)) / 2)];
  }
  return a || b;
}

// Overlay regions mapped to the SVG viewBox (532.49 x 437.37)
// Left figure = anterior (~center x=121), Right figure = posterior (~center x=411)
const overlayRegions = {
  // ANTERIOR (left figure)
  // Ombro RI - left shoulder
  antShoulderLeft: "M55,72 Q42,65 38,82 Q36,98 44,105 L62,95 L72,80 Z",
  // Ombro RI - right shoulder  
  antShoulderRight: "M187,72 Q200,65 204,82 Q206,98 198,105 L180,95 L170,80 Z",
  // Quadril RI - left hip
  antHipLeft: "M82,178 L100,188 L121,192 L121,208 L98,216 L78,206 Z",
  // Quadril RI - right hip
  antHipRight: "M160,178 L142,188 L121,192 L121,208 L144,216 L164,206 Z",
  // Quadríceps + Psoas - left thigh
  antThighLeft: "M78,206 L98,216 L121,208 L118,300 L92,304 L80,290 Z",
  // Quadríceps + Psoas - right thigh
  antThighRight: "M164,206 L144,216 L121,208 L124,300 L150,304 L162,290 Z",

  // POSTERIOR (right figure)
  // Ombro RE - left shoulder (mirrored view, so anatomical right)
  postShoulderLeft: "M345,72 Q332,65 328,82 Q326,98 334,105 L352,95 L362,80 Z",
  // Ombro RE - right shoulder
  postShoulderRight: "M477,72 Q490,65 494,82 Q496,98 488,105 L470,95 L460,80 Z",
  // Torácica - back region
  postThoracic: "M365,80 L378,88 L444,88 L457,80 L454,178 L436,188 L411,192 L386,188 L368,178 Z",
  // Quadril RE - left glute
  postHipLeft: "M370,178 L388,188 L411,192 L411,210 L390,218 L374,206 Z",
  // Quadril RE - right glute
  postHipRight: "M452,178 L434,188 L411,192 L411,210 L432,218 L448,206 Z",
  // Posterior MMII - left hamstring
  postHamLeft: "M374,206 L390,218 L411,210 L408,302 L384,306 L372,290 Z",
  // Posterior MMII - right hamstring
  postHamRight: "M448,206 L432,218 L411,210 L414,302 L438,306 L450,290 Z",
  // Tornozelo - left ankle/foot
  postAnkleLeft: "M380,385 L404,385 L406,408 Q400,418 382,418 Q376,416 378,402 Z",
  // Tornozelo - right ankle/foot
  postAnkleRight: "M418,385 L442,385 L444,408 Q438,418 420,418 Q414,416 416,402 Z",
};

export function BodyDiagram({ classifications }: BodyDiagramProps) {
  const fills = useMemo(() => {
    const ombroRI = classifications["Mobilidade Ombro RI"] || { left: null, right: null };
    const psoas = classifications["Flexibilidade Psoas"] || { left: null, right: null };
    const quads = classifications["Flexibilidade Quadríceps"] || { left: null, right: null };
    const quadrilRI = classifications["Mobilidade Quadril RI"] || { left: null, right: null };
    const ombroRE = classifications["Mobilidade Ombro RE"] || { left: null, right: null };
    const quadrilRE = classifications["Mobilidade Quadril RE"] || { left: null, right: null };
    const mmii = classifications["Flexibilidade Posterior MMII"] || { left: null, right: null };
    const toracica = classifications["Mobilidade Torácica"] || { left: null, right: null };
    const tornozelo = classifications["Mobilidade Tornozelo"] || { left: null, right: null };

    return {
      // Anterior
      antShoulderLeft: getFill(ombroRI.left),
      antShoulderRight: getFill(ombroRI.right),
      antHipLeft: getFill(quadrilRI.left),
      antHipRight: getFill(quadrilRI.right),
      antThighLeft: getFill(avgClassification(quads.left, psoas.left)),
      antThighRight: getFill(avgClassification(quads.right, psoas.right)),
      // Posterior
      postShoulderLeft: getFill(ombroRE.left),
      postShoulderRight: getFill(ombroRE.right),
      postThoracic: getFill(avgClassification(toracica.left, toracica.right)),
      postHipLeft: getFill(quadrilRE.left),
      postHipRight: getFill(quadrilRE.right),
      postHamLeft: getFill(mmii.left),
      postHamRight: getFill(mmii.right),
      postAnkleLeft: getFill(tornozelo.left),
      postAnkleRight: getFill(tornozelo.right),
    };
  }, [classifications]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[480px]">
        <img
          src={corpoHumano}
          alt="Corpo humano - vista anterior e posterior"
          className="w-full h-auto"
        />
        <svg
          viewBox="0 0 532.49 437.37"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.entries(overlayRegions).map(([key, path]) => {
            const fill = fills[key as keyof typeof fills];
            if (!fill) return null;
            return (
              <path
                key={key}
                d={path}
                fill={fill}
                opacity={0.45}
                stroke={fill}
                strokeWidth={1}
                strokeOpacity={0.7}
              />
            );
          })}
        </svg>
        {/* View labels */}
        <div className="absolute bottom-1 left-[15%] text-[10px] text-muted-foreground font-medium">
          Vista Anterior
        </div>
        <div className="absolute bottom-1 right-[10%] text-[10px] text-muted-foreground font-medium">
          Vista Posterior
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(["Fraco", "Regular", "Médio", "Bom", "Excelente"] as const).map(level => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: classificationFill[level] }} />
            <span className="text-[10px] text-muted-foreground">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
