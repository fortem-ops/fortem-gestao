import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneMap = {
  default: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-destructive",
};

export function KpiCard({ label, value, icon: Icon, hint, tone = "default" }: Props) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-display font-semibold mt-1", toneMap[tone])}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {Icon && <Icon className={cn("h-5 w-5", toneMap[tone])} />}
      </CardContent>
    </Card>
  );
}
