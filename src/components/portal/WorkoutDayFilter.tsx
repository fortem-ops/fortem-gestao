import { cn } from "@/lib/utils";

const DAYS = [
  { key: "T1", label: "T1" },
  { key: "T2", label: "T2" },
  { key: "T3", label: "T3" },
  { key: "T4", label: "T4" },
];

interface WorkoutDayFilterProps {
  value: string | null;
  onChange: (day: string | null) => void;
}

export function WorkoutDayFilter({ value, onChange }: WorkoutDayFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
          value === null
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
        )}
      >
        Todos
      </button>
      {DAYS.map((d) => (
        <button
          key={d.key}
          onClick={() => onChange(d.key)}
          className={cn(
            "w-9 h-8 rounded-full text-xs font-semibold transition-colors border",
            value === d.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
