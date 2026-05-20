import { useMemo } from "react";
import { motion } from "framer-motion";
import { bandFromScore, bandLabel, type SeverityBand } from "./scoringPremium";

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  /** Sub-rótulo opcional (ex.: "BOM", "ATENÇÃO") — quando omitido derivamos da banda. */
  statusLabel?: string;
  /** Reduz a intensidade do glow quando true (cards secundários). */
  subtle?: boolean;
  /** Override de banda (ex.: para "Risco" inverter cores). */
  band?: SeverityBand;
}

const BAND_TONE: Record<SeverityBand, { text: string; bar: string; glow: string }> = {
  good: { text: "text-emerald-300", bar: "hsl(var(--sev-good))", glow: "bio-glow-good" },
  warn: { text: "text-amber-300", bar: "hsl(var(--sev-attention))", glow: "bio-glow-warn" },
  risk: { text: "text-rose-300", bar: "hsl(var(--sev-weak))", glow: "bio-glow-risk" },
  none: { text: "text-white/40", bar: "hsl(0 0% 100% / 0.2)", glow: "" },
};

export function DashboardScoreCard({ label, value, unit = "%", statusLabel, subtle, band }: Props) {
  const computedBand = band ?? bandFromScore(value);
  const tone = BAND_TONE[computedBand];
  const pct = useMemo(() => (value === null ? 0 : Math.max(0, Math.min(100, value))), [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bio-card bio-card-hover p-4 relative overflow-hidden ${subtle ? "" : tone.glow}`}
    >
      <p className="bio-label">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl bio-heading ${tone.text}`}>
          {value !== null ? value : "—"}
        </span>
        {value !== null && unit && <span className="text-sm text-white/40">{unit}</span>}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: tone.bar, boxShadow: `0 0 12px ${tone.bar}` }}
          className="h-full"
        />
      </div>
      <p className={`mt-2 text-[11px] font-semibold tracking-wider uppercase ${tone.text}`}>
        {statusLabel ?? bandLabel(computedBand)}
      </p>
    </motion.div>
  );
}
