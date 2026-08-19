import type { BodyMapAnalysis, RegionId, Layer } from "./bodyMapLogic";
import { SEVERITY_LABEL } from "./bodyMapLogic";

const REGION_SHORT_LABEL: Record<RegionId, string> = {
  "shoulder-l":     "Ombro (E)",
  "shoulder-r":     "Ombro (D)",
  "shoulder-re-l":  "Ombro RE (E)",
  "shoulder-re-r":  "Ombro RE (D)",
  "elbow-l":        "Cotovelo (E)",
  "elbow-r":        "Cotovelo (D)",
  "wrist-l":        "Punho (E)",
  "wrist-r":        "Punho (D)",
  "thoracic":       "Coluna torácica",
  "lumbar":         "Lombar",
  "hip-l":          "Quadril (E)",
  "hip-r":          "Quadril (D)",
  "hip-re-l":       "Quadril RE (E)",
  "hip-re-r":       "Quadril RE (D)",
  "psoas-l":        "Psoas (E)",
  "psoas-r":        "Psoas (D)",
  "quad-l":         "Quadríceps (E)",
  "quad-r":         "Quadríceps (D)",
  "ham-l":          "Posterior coxa (E)",
  "ham-r":          "Posterior coxa (D)",
  "ankle-l":        "Tornozelo (E)",
  "ankle-r":        "Tornozelo (D)",
};

export interface RegionListItem {
  id: RegionId;
  number: number;
  label: string;
  metricLabel: string;
  percentage: number;
  riskLabel?: string;
  riskColor?: string;
}

export function buildRegionList(analysis: BodyMapAnalysis, max = 6, layer?: Layer): RegionListItem[] {
  const entries = (Object.entries(analysis.regions) as Array<[RegionId, BodyMapAnalysis["regions"][RegionId]]>)
    .filter(([, s]) => s.asymmetry !== undefined && s.asymmetry > 0);

  entries.sort(([, a], [, b]) => (b.asymmetry ?? 0) - (a.asymmetry ?? 0));

  return entries.slice(0, max).map(([id, state], i) => {
    const firstMetric = state.contributing[0]?.metric ?? "—";
    const metricLabel = firstMetric
      .replace(/^Mobilidade\s+/i, "")
      .replace(/^Flexibilidade\s+/i, "");
    const asymValue = state.asymmetry ?? 0;
    const isForca = layer === "strength";
    const riskLabel = isForca ? (asymValue < 10 ? "BAIXO" : asymValue < 20 ? "ATENÇÃO" : "ALTO") : undefined;
    const riskColor = isForca
      ? (asymValue < 10 ? "var(--sev-good)" : asymValue < 20 ? "var(--sev-attention)" : "var(--sev-weak)")
      : undefined;
    return {
      id,
      number: i + 1,
      label: REGION_SHORT_LABEL[id],
      metricLabel,
      percentage: Math.round(state.asymmetry ?? 0),
      riskLabel,
      riskColor,
    };
  });
}

export function RegionListPanel({ items }: { items: RegionListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] p-6 text-center text-[12px] text-[hsl(var(--bio-ink-muted))]">
        Nenhuma assimetria identificada nesta camada.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] divide-y divide-[hsl(var(--bio-line))]">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold shrink-0 bg-[hsl(var(--bio-surface))] text-[hsl(var(--bio-ink-muted))] border border-[hsl(var(--bio-line))]">
            {it.number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[hsl(var(--bio-ink))] leading-tight truncate">
              {it.label}
            </p>
            <p className="text-[11px] text-[hsl(var(--bio-ink-muted))] truncate">{it.metricLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-[14px] font-bold leading-tight"
              style={it.riskColor ? { color: `hsl(${it.riskColor})` } : undefined}
            >
              {it.percentage}%
            </p>
            {it.riskLabel && (
              <p
                className="text-[10px] font-semibold"
                style={{ color: `hsl(${it.riskColor})` }}
              >
                {it.riskLabel}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { SEVERITY_LABEL };
