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

const BASE_FILL = "#D1D5DB";
const BASE_STROKE = "#B0B4BA";
const INACTIVE_FILL = "#E5E7EB";
const MUSCLE_LINE = "#C8CCD2";

function getFill(c: AssessmentClassification | null) {
  return c ? classificationFill[c] || INACTIVE_FILL : INACTIVE_FILL;
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

/* ── Anterior View SVG ── */
function AnteriorBody({ fills }: { fills: Record<string, string> }) {
  return (
    <svg viewBox="0 0 260 500" width="200" height="420" className="drop-shadow-md">
      {/* Head */}
      <ellipse cx="130" cy="38" rx="26" ry="32" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="1" />
      <path d="M118 30 Q130 22 142 30" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <ellipse cx="122" cy="32" rx="3" ry="4" fill={BASE_FILL} />
      <ellipse cx="138" cy="32" rx="3" ry="4" fill={BASE_FILL} />
      <path d="M125 42 Q130 46 135 42" fill="none" stroke={BASE_STROKE} strokeWidth="0.6" />

      {/* Neck */}
      <rect x="120" y="68" width="20" height="16" rx="5" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="126" y1="70" x2="126" y2="82" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <line x1="134" y1="70" x2="134" y2="82" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Trapezius */}
      <path d="M104 82 L120 82 L130 74 L140 82 L156 82 L148 94 L112 94 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* ── SHOULDERS (Ombro RI - anterior deltoid) ── */}
      {/* Left shoulder */}
      <path d="M82 90 Q72 82 68 96 Q66 110 74 118 L88 108 L96 94 Z"
            fill={fills.shoulderLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M78 94 Q74 104 76 114" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M84 92 Q78 102 80 112" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />

      {/* Right shoulder */}
      <path d="M178 90 Q188 82 192 96 Q194 110 186 118 L172 108 L164 94 Z"
            fill={fills.shoulderRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M182 94 Q186 104 184 114" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M176 92 Q182 102 180 112" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />

      {/* ── CHEST (Pectorals - part of anterior) ── */}
      <path d="M96 94 L112 94 L130 100 L148 94 L164 94 L160 130 L148 140 L130 142 L112 140 L100 130 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M108 98 Q120 112 130 100 Q140 112 152 98" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M104 106 Q118 122 130 116 Q142 122 156 106" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Upper arms */}
      <path d="M74 118 L88 108 L86 168 L70 168 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="80" y1="120" x2="79" y2="165" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M186 118 L172 108 L174 168 L190 168 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="180" y1="120" x2="181" y2="165" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Forearms */}
      <path d="M70 170 L86 170 L82 232 L68 232 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="77" y1="172" x2="76" y2="228" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M190 170 L174 170 L178 232 L192 232 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="183" y1="172" x2="184" y2="228" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Hands */}
      <path d="M68 232 L82 232 L80 248 Q76 256 68 254 Q62 250 66 238 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M192 232 L178 232 L180 248 Q184 256 192 254 Q198 250 194 238 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* ── ABDOMEN ── */}
      <path d="M100 130 L112 140 L130 142 L148 140 L160 130 L158 186 L140 198 L130 200 L120 198 L102 186 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      {/* Abs lines */}
      <line x1="130" y1="142" x2="130" y2="196" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M114 152 L146 152" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M112 164 L148 164" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M110 176 L150 176" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />

      {/* ── HIP / PELVIS (Quadril RI) ── */}
      {/* Left hip */}
      <path d="M102 186 L120 198 L130 200 L130 220 L112 230 L96 220 Z"
            fill={fills.hipLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M108 196 Q114 210 116 224" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Right hip */}
      <path d="M158 186 L140 198 L130 200 L130 220 L148 230 L164 220 Z"
            fill={fills.hipRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M152 196 Q146 210 144 224" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* ── THIGHS (Psoas + Quadríceps) ── */}
      {/* Left thigh - quadriceps */}
      <path d="M96 220 L112 230 L130 220 L126 330 L100 334 L90 320 Z"
            fill={fills.thighLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      {/* Quad muscle lines */}
      <path d="M106 234 Q104 280 102 328" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M114 228 Q112 280 110 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M122 224 Q120 278 118 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Right thigh - quadriceps */}
      <path d="M164 220 L148 230 L130 220 L134 330 L160 334 L170 320 Z"
            fill={fills.thighRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M154 234 Q156 280 158 328" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M146 228 Q148 280 150 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M138 224 Q140 278 142 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Knees */}
      <ellipse cx="110" cy="340" rx="14" ry="10" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <ellipse cx="150" cy="340" rx="14" ry="10" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* ── LOWER LEGS (shin - tibialis, inactive in anterior) ── */}
      <path d="M96 348 L124 348 L120 430 L98 430 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M108 350 Q107 390 109 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      <path d="M136 348 L164 348 L162 430 L140 430 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M152 350 Q153 390 151 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Feet */}
      <path d="M94 430 L124 430 L126 448 Q120 458 98 458 Q90 456 92 440 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M136 430 L166 430 L168 448 Q162 458 140 458 Q132 456 134 440 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* Side labels */}
      <text x="56" y="200" textAnchor="middle" fontSize="12" fill="#9CA3AF" fontWeight="600" fontFamily="Inter, sans-serif">D</text>
      <text x="204" y="200" textAnchor="middle" fontSize="12" fill="#9CA3AF" fontWeight="600" fontFamily="Inter, sans-serif">E</text>

      {/* View label */}
      <text x="130" y="480" textAnchor="middle" fontSize="11" fill="#9CA3AF" fontFamily="Inter, sans-serif" fontWeight="500">
        Vista Anterior
      </text>
    </svg>
  );
}

/* ── Posterior View SVG ── */
function PosteriorBody({ fills }: { fills: Record<string, string> }) {
  return (
    <svg viewBox="0 0 260 500" width="200" height="420" className="drop-shadow-md">
      {/* Head */}
      <ellipse cx="130" cy="38" rx="26" ry="32" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="1" />
      <path d="M116 28 Q130 18 144 28" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />

      {/* Neck */}
      <rect x="120" y="68" width="20" height="16" rx="5" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="130" y1="70" x2="130" y2="82" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Trapezius / upper back */}
      <path d="M96 82 L120 82 L130 74 L140 82 L164 82 L156 100 L104 100 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M110 80 Q130 70 150 80" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* ── SHOULDERS (Ombro RE - posterior deltoid) ── */}
      {/* Left shoulder */}
      <path d="M82 88 Q68 80 64 98 Q62 114 72 120 L86 110 L96 94 Z"
            fill={fills.shoulderLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M76 92 Q72 104 74 116" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M82 90 Q76 102 78 114" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />

      {/* Right shoulder */}
      <path d="M178 88 Q192 80 196 98 Q198 114 188 120 L174 110 L164 94 Z"
            fill={fills.shoulderRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M184 92 Q188 104 186 116" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />
      <path d="M178 90 Q184 102 182 114" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.6" />

      {/* ── THORACIC / BACK (Mobilidade Torácica) ── */}
      <path d="M96 94 L104 100 L156 100 L164 94 L160 186 L140 198 L130 200 L120 198 L100 186 Z"
            fill={fills.thoracic} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.85" />
      {/* Spine line */}
      <line x1="130" y1="100" x2="130" y2="196" stroke={MUSCLE_LINE} strokeWidth="0.8" />
      {/* Back muscle fibers */}
      <path d="M118 106 Q110 130 106 160" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M142 106 Q150 130 154 160" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M122 110 Q116 140 112 172" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M138 110 Q144 140 148 172" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      {/* Lat lines */}
      <path d="M104 120 Q96 140 100 168" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />
      <path d="M156 120 Q164 140 160 168" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.4" />

      {/* Upper arms */}
      <path d="M72 120 L86 110 L84 170 L68 170 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="78" y1="122" x2="77" y2="167" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M188 120 L174 110 L176 170 L192 170 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <line x1="182" y1="122" x2="183" y2="167" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Forearms */}
      <path d="M68 172 L84 172 L80 234 L66 234 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M192 172 L176 172 L180 234 L194 234 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* Hands */}
      <path d="M66 234 L80 234 L78 250 Q74 258 66 256 Q60 252 64 240 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M194 234 L180 234 L182 250 Q186 258 194 256 Q200 252 196 240 Z" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* ── GLUTES / HIP (Quadril RE) ── */}
      {/* Left glute */}
      <path d="M100 186 L120 198 L130 200 L130 224 L108 230 L94 218 Z"
            fill={fills.hipLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M106 196 Q110 212 112 226" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M112 194 Q116 210 118 224" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Right glute */}
      <path d="M160 186 L140 198 L130 200 L130 224 L152 230 L166 218 Z"
            fill={fills.hipRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M154 196 Q150 212 148 226" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M148 194 Q144 210 142 224" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* ── HAMSTRINGS (Flexibilidade Posterior MMII) ── */}
      {/* Left hamstring */}
      <path d="M94 218 L108 230 L130 224 L126 332 L100 336 L88 318 Z"
            fill={fills.calfLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M104 234 Q102 280 100 328" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M112 228 Q110 280 108 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M120 226 Q118 280 116 332" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Right hamstring */}
      <path d="M166 218 L152 230 L130 224 L134 332 L160 336 L172 318 Z"
            fill={fills.calfRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M156 234 Q158 280 160 328" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M148 228 Q150 280 152 330" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M140 226 Q142 280 144 332" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* Knees */}
      <ellipse cx="110" cy="342" rx="14" ry="10" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <ellipse cx="150" cy="342" rx="14" ry="10" fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />

      {/* ── CALVES (gastrocnemius) ── */}
      <path d="M96 350 L124 350 L120 430 L98 430 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M106 352 Q108 380 108 390 Q106 410 108 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M114 352 Q116 380 116 390 Q114 410 116 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      <path d="M136 350 L164 350 L162 430 L140 430 Z"
            fill={INACTIVE_FILL} stroke={BASE_STROKE} strokeWidth="0.8" />
      <path d="M146 352 Q148 380 148 390 Q146 410 148 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />
      <path d="M154 352 Q156 380 156 390 Q154 410 156 428" fill="none" stroke={MUSCLE_LINE} strokeWidth="0.5" />

      {/* ── ANKLES (Mobilidade Tornozelo) ── */}
      <path d="M94 430 L124 430 L126 448 Q120 458 98 458 Q90 456 92 440 Z"
            fill={fills.ankleLeft} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />
      <path d="M136 430 L166 430 L168 448 Q162 458 140 458 Q132 456 134 440 Z"
            fill={fills.ankleRight} stroke={BASE_STROKE} strokeWidth="0.8" opacity="0.9" />

      {/* Side labels */}
      <text x="52" y="200" textAnchor="middle" fontSize="12" fill="#9CA3AF" fontWeight="600" fontFamily="Inter, sans-serif">E</text>
      <text x="208" y="200" textAnchor="middle" fontSize="12" fill="#9CA3AF" fontWeight="600" fontFamily="Inter, sans-serif">D</text>

      {/* View label */}
      <text x="130" y="480" textAnchor="middle" fontSize="11" fill="#9CA3AF" fontFamily="Inter, sans-serif" fontWeight="500">
        Vista Posterior
      </text>
    </svg>
  );
}

export function BodyDiagram({ classifications }: BodyDiagramProps) {
  const [view, setView] = useState<string>("anterior");

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

    if (view === "anterior") {
      return {
        shoulderLeft: getFill(ombroRI.left),
        shoulderRight: getFill(ombroRI.right),
        thoracic: INACTIVE_FILL,
        hipLeft: getFill(quadrilRI.left),
        hipRight: getFill(quadrilRI.right),
        thighLeft: getFill(avgClassification(quads.left, psoas.left)),
        thighRight: getFill(avgClassification(quads.right, psoas.right)),
        calfLeft: INACTIVE_FILL,
        calfRight: INACTIVE_FILL,
        ankleLeft: INACTIVE_FILL,
        ankleRight: INACTIVE_FILL,
      };
    } else {
      return {
        shoulderLeft: getFill(ombroRE.left),
        shoulderRight: getFill(ombroRE.right),
        thoracic: getFill(avgClassification(toracica.left, toracica.right)),
        hipLeft: getFill(quadrilRE.left),
        hipRight: getFill(quadrilRE.right),
        thighLeft: INACTIVE_FILL,
        thighRight: INACTIVE_FILL,
        calfLeft: getFill(mmii.left),
        calfRight: getFill(mmii.right),
        ankleLeft: getFill(tornozelo.left),
        ankleRight: getFill(tornozelo.right),
      };
    }
  }, [classifications, view]);

  return (
    <div className="flex flex-col items-center gap-3">
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => v && setView(v)}
        size="sm"
        className="bg-secondary/50 rounded-md p-0.5 border border-border"
      >
        <ToggleGroupItem
          value="anterior"
          className="text-[10px] px-2.5 py-1 h-6 rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          Anterior
        </ToggleGroupItem>
        <ToggleGroupItem
          value="posterior"
          className="text-[10px] px-2.5 py-1 h-6 rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          Posterior
        </ToggleGroupItem>
      </ToggleGroup>

      {view === "anterior" ? <AnteriorBody fills={fills} /> : <PosteriorBody fills={fills} />}

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
