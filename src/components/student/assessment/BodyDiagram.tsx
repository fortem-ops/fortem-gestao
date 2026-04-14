import { useMemo, useState } from "react";
import type { AssessmentClassification } from "@/lib/mock-data";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

const DEFAULT_FILL = "hsl(228, 10%, 25%)";

function getFill(c: AssessmentClassification | null) {
  return c ? classificationFill[c] || DEFAULT_FILL : DEFAULT_FILL;
}

function avgClassification(left: AssessmentClassification | null, right: AssessmentClassification | null): AssessmentClassification | null {
  if (left && right) {
    const order: AssessmentClassification[] = ["Fraco", "Regular", "Médio", "Bom", "Excelente"];
    const li = order.indexOf(left);
    const ri = order.indexOf(right);
    return order[Math.round((li + ri) / 2)];
  }
  return left || right;
}

export function BodyDiagram({ classifications }: BodyDiagramProps) {
  const [view, setView] = useState<string>("anterior");

  const fills = useMemo(() => {
    // Anterior metrics
    const ombroRI = classifications["Mobilidade Ombro RI"] || { left: null, right: null };
    const psoas = classifications["Flexibilidade Psoas"] || { left: null, right: null };
    const quads = classifications["Flexibilidade Quadríceps"] || { left: null, right: null };
    const quadrilRI = classifications["Mobilidade Quadril RI"] || { left: null, right: null };

    // Posterior metrics
    const ombroRE = classifications["Mobilidade Ombro RE"] || { left: null, right: null };
    const quadrilRE = classifications["Mobilidade Quadril RE"] || { left: null, right: null };
    const mmii = classifications["Flexibilidade Posterior MMII"] || { left: null, right: null };
    const toracica = classifications["Mobilidade Torácica"] || { left: null, right: null };
    const tornozelo = classifications["Mobilidade Tornozelo"] || { left: null, right: null };

    if (view === "anterior") {
      return {
        shoulderLeft: getFill(ombroRI.left),
        shoulderRight: getFill(ombroRI.right),
        thoracic: DEFAULT_FILL,
        hipLeft: getFill(quadrilRI.left),
        hipRight: getFill(quadrilRI.right),
        thighLeft: getFill(avgClassification(quads.left, psoas.left)),
        thighRight: getFill(avgClassification(quads.right, psoas.right)),
        calfLeft: DEFAULT_FILL,
        calfRight: DEFAULT_FILL,
        ankleLeft: DEFAULT_FILL,
        ankleRight: DEFAULT_FILL,
      };
    } else {
      return {
        shoulderLeft: getFill(ombroRE.left),
        shoulderRight: getFill(ombroRE.right),
        thoracic: getFill(avgClassification(toracica.left, toracica.right)),
        hipLeft: getFill(quadrilRE.left),
        hipRight: getFill(quadrilRE.right),
        thighLeft: DEFAULT_FILL,
        thighRight: DEFAULT_FILL,
        calfLeft: getFill(mmii.left),
        calfRight: getFill(mmii.right),
        ankleLeft: getFill(tornozelo.left),
        ankleRight: getFill(tornozelo.right),
      };
    }
  }, [classifications, view]);

  return (
    <div className="flex flex-col items-center gap-3">
      <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} size="sm" className="bg-secondary/50 rounded-md p-0.5 border border-border">
        <ToggleGroupItem value="anterior" className="text-[10px] px-2.5 py-1 h-6 rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          Anterior
        </ToggleGroupItem>
        <ToggleGroupItem value="posterior" className="text-[10px] px-2.5 py-1 h-6 rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          Posterior
        </ToggleGroupItem>
      </ToggleGroup>

      <svg viewBox="0 0 200 420" width="180" height="380" className="drop-shadow-lg">
        {/* Head */}
        <ellipse cx="100" cy="32" rx="22" ry="28" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />
        {/* Neck */}
        <rect x="91" y="58" width="18" height="14" rx="4" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />

        {/* Shoulders */}
        <ellipse cx="65" cy="82" rx="18" ry="12" fill={fills.shoulderLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />
        <ellipse cx="135" cy="82" rx="18" ry="12" fill={fills.shoulderRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />

        {/* Upper arms */}
        <rect x="42" y="88" width="16" height="50" rx="8" fill={fills.shoulderLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.7" />
        <rect x="142" y="88" width="16" height="50" rx="8" fill={fills.shoulderRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.7" />

        {/* Forearms */}
        <rect x="40" y="138" width="14" height="50" rx="7" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />
        <rect x="146" y="138" width="14" height="50" rx="7" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />

        {/* Hands */}
        <ellipse cx="47" cy="196" rx="8" ry="10" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />
        <ellipse cx="153" cy="196" rx="8" ry="10" fill={DEFAULT_FILL} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" />

        {/* Torso */}
        <path d="M72 72 L128 72 L132 90 L134 160 L120 180 L80 180 L66 160 L68 90 Z"
              fill={fills.thoracic} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.85" />

        {/* Hip */}
        <path d="M80 180 L100 180 L100 210 L78 215 Z"
              fill={fills.hipLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />
        <path d="M100 180 L120 180 L122 215 L100 210 Z"
              fill={fills.hipRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />

        {/* Thigh */}
        <path d="M78 215 L100 210 L96 300 L76 300 Z"
              fill={fills.thighLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.85" />
        <path d="M100 210 L122 215 L124 300 L104 300 Z"
              fill={fills.thighRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.85" />

        {/* Calf */}
        <path d="M76 302 L96 302 L94 370 L78 370 Z"
              fill={fills.calfLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.85" />
        <path d="M104 302 L124 302 L122 370 L106 370 Z"
              fill={fills.calfRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.85" />

        {/* Ankle */}
        <ellipse cx="86" cy="380" rx="12" ry="8" fill={fills.ankleLeft} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />
        <ellipse cx="114" cy="380" rx="12" ry="8" fill={fills.ankleRight} stroke="hsl(228, 10%, 35%)" strokeWidth="0.8" opacity="0.9" />

        {/* Side labels */}
        <text x="47" y="220" textAnchor="middle" fontSize="8" fill="hsl(220, 10%, 55%)" fontFamily="Inter, sans-serif">E</text>
        <text x="153" y="220" textAnchor="middle" fontSize="8" fill="hsl(220, 10%, 55%)" fontFamily="Inter, sans-serif">D</text>

        {/* View label */}
        <text x="100" y="415" textAnchor="middle" fontSize="9" fill="hsl(220, 10%, 50%)" fontFamily="Inter, sans-serif">
          {view === "anterior" ? "Vista Anterior" : "Vista Posterior"}
        </text>
      </svg>

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
