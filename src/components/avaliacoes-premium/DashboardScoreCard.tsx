import { useMemo } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bandFromScore, bandLabel, type SeverityBand } from "./scoringPremium";

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  statusLabel?: string;
  subtle?: boolean;
  band?: SeverityBand;
  tooltip?: string;
}

const BAND_TONE: Record<SeverityBand, { text: string; bar: string; glow: string }> = {
  good: { text: "text-emerald-600", bar: "hsl(var(--sev-good))", glow: "bio-glow-good" },
  warn: { text: "text-amber-600", bar: "hsl(var(--sev-attention))", glow: "bio-glow-warn" },
  risk: { text: "text-rose-600", bar: "hsl(var(--sev-weak))", glow: "bio-glow-risk" },
  none: { text: "text-[hsl(var(--bio-ink-faint))]", bar: "hsl(220 14% 80%)", glow: "" },
};

export function DashboardScoreCard({ label, value, unit = "%", statusLabel, subtle, band, tooltip }: Props) {
  const computedBand = band ?? bandFromScore(value);
  const tone = BAND_TONE[computedBand];
  const pct = useMemo(() => (value === null ? 0 : Math.max(0, Math.min(100, value))), [value]);

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bio-card bio-card-hover p-4 relative overflow-hidden ${subtle ? "" : tone.glow} ${tooltip ? "cursor-help" : ""}`}
    >
      {tooltip && (
        <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-[hsl(var(--bio-ink-faint))]" aria-hidden />
      )}
      <p className="bio-label">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl bio-heading ${tone.text}`}>
          {value !== null ? value : "—"}
        </span>
        {value !== null && unit && <span className="text-sm text-[hsl(var(--bio-ink-faint))]">{unit}</span>}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[hsl(var(--bio-surface-2))] overflow-hidden">
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

  if (!tooltip) return card;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{card}</div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed bg-[hsl(var(--bio-surface))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
