import { Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";

interface WorkoutExerciseItemProps {
  exercise: WorkoutExercise;
  onClick: () => void;
  completed?: boolean;
  onToggle?: () => void;
}

export function WorkoutExerciseItem({ exercise, onClick, completed, onToggle }: WorkoutExerciseItemProps) {
  const hasVideo = !!exercise.video_url;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-colors",
        completed
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-border hover:border-primary/40"
      )}
    >
      {onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            completed
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40 text-transparent hover:border-primary"
          )}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
          {hasVideo ? (
            <Play className="w-4 h-4 text-primary" />
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">
              {exercise.ordem}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold truncate", completed && "text-primary")}>
            {exercise.exercicio || "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {exercise.categoria}
            {exercise.subcategoria ? ` · ${exercise.subcategoria}` : ""}
            {" · "}
            {exercise.series}x{exercise.repeticoes}
            {exercise.kg ? ` · ${exercise.kg}` : ""}
          </p>
        </div>
      </button>
    </div>
  );
}
