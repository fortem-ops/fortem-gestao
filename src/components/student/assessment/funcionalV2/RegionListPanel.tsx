import type { BodyMapAnalysis, RegionId, Severity } from "./bodyMapLogic";
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL } from "./bodyMapLogic";

const REGION_SHORT_LABEL: Record<RegionId, string> = {
  "shoulder-l": "Ombro (E)",
  "shoulder-r": "Ombro (D)",
  "thoracic":   "Coluna torácica",
  "lumbar":     "Lombar",
  "hip-l":      "Quadril (E)",
  "hip-r":      "Quadril (D)",
  "quad-l":     "Quadríceps (E)",
  "quad-r":     "Quadríceps (D)",
  "ham-l":      "Posterior coxa (E)",
  "ham-r":      "Posterior coxa (D)",
  "ankle-l":    "Tornozelo (E)",
  "ankle-r":    "Tornozelo (D)",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  weak: 0, attention: 1, medium: 2, good: 3, excellent: 4, none: 5,
};

export interface RegionListItem {
  id: RegionId;
  number: number;
  label: string;
  metricLabel: string;
  percentage: number;
  classification: string;
  severity: Severity;
}

function classificationFor(state: BodyMapAnalysis["regions"][RegionId]): string {
  if (state.asymmetry !== undefined && state.asymmetry >= 25) return "Assimetria elevada";
  if (state.asymmetry !== undefined && state.asymmetry >= 15) return "Assimetria moderada";
  if (state.severity === "weak")      return "Déficit de mobilidade";
  if (state.severity === "attention") return "Atenção";
  if (state.severity === "medium")    return "Pode melhorar";
  if (state.severity === "good")      return "Bom";
  if (state.severity === "excellent") return "Excelente";
  return "Equilibrado";
}

export function buildRegionList(analysis: BodyMapAnalysis, max = 6): RegionListItem[] {
  const entries = (Object.entries(analysis.regions) as Array<[RegionId, BodyMapAnalysis["regions"][RegionId]]>)
    .filter(([, s]) => s.severity !== "none");

  entries.sort(([, a], [, b]) => {
    const sa = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sa !== 0) return sa;
    const asymA = a.asymmetry ?? 0;
    const asymB = b.asymmetry ?? 0;
    return asymB - asymA;
  });

  return entries.slice(0, max).map(([id, state], i) => {
    const firstMetric = state.contributing[0]?.metric ?? "—";
    const metricLabel = firstMetric
      .replace(/^Mobilidade\s+/i, "")
      .replace(/^Flexibilidade\s+/i, "");
    const percentage = state.asymmetry !== undefined && state.asymmetry > 0
      ? state.asymmetry
      : (state.score !== null ? Math.max(0, 100 - state.score) : 0);
    return {
      id,
      number: i + 1,
      label: REGION_SHORT_LABEL[id],
      metricLabel,
      percentage,
      classification: classificationFor(state),
      severity: state.severity,
    };
  });
}

export function RegionListPanel({ items }: { items: RegionListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-[12px] text-white/40">
        Nenhum ponto de atenção identificado nesta camada.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
      {items.map((it) => {
        const color = SEVERITY_COLOR_VAR[it.severity];
        const pctColor =
          it.severity === "weak" || it.severity === "attention"
            ? color
            : "var(--sev-good)";
        return (
          <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold shrink-0"
              style={{
                background: `hsl(${color} / 0.15)`,
                color: `hsl(${color})`,
                border: `1.5px solid hsl(${color} / 0.6)`,
              }}
            >
              {it.number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight truncate">
                {it.label}
              </p>
              <p className="text-[11px] text-white/50 truncate">{it.metricLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[14px] font-bold leading-tight" style={{ color: `hsl(${pctColor})` }}>
                {it.percentage}%
              </p>
              <p className="text-[10px]" style={{ color: `hsl(${color})` }}>
                {it.classification}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { SEVERITY_LABEL };
