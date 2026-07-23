import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkoutWeeklyProgressProps {
  feitos: number;
  meta: number;
}

export function WorkoutWeeklyProgress({ feitos, meta }: WorkoutWeeklyProgressProps) {
  const safeMeta = Math.max(1, meta);
  const pct = Math.min(100, (feitos / safeMeta) * 100);
  const corBarra =
    pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-primary" : pct >= 25 ? "bg-warning" : "bg-destructive";

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Esta semana
          </p>
          <p
            className="text-xl font-black text-foreground"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            {feitos} <span className="text-sm text-muted-foreground font-medium">de {safeMeta} treinos</span>
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#2C2C2C] flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", corBarra)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        {feitos >= safeMeta
          ? "Meta semanal atingida! 🎉"
          : `Faltam ${safeMeta - feitos} treino${safeMeta - feitos > 1 ? "s" : ""} para bater a meta.`}
      </p>
    </div>
  );
}
