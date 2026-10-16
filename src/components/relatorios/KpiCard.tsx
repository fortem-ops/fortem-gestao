import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  extra?: string;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}

const toneMap = {
  default: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-destructive",
};

export function KpiCard({ label, value, icon: Icon, hint, extra, tone = "default", onClick }: Props) {
  const clicavel = !!onClick;
  return (
    <Card
      className={cn("glass-card", clicavel && "cursor-pointer transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      onClick={onClick}
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onKeyDown={clicavel ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
    >
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-display font-semibold mt-1", toneMap[tone])}>{value}</p>
          {extra && <p className="text-xs font-medium text-amber-500 mt-1">{extra}</p>}
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {Icon && <Icon className={cn("h-5 w-5", toneMap[tone])} />}
      </CardContent>
    </Card>
  );
}
