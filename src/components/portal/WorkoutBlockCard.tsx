import { useState } from "react";
import { ChevronDown, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkoutExerciseItem } from "./WorkoutExerciseItem";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";

interface WorkoutBlockCardProps {
  title: string;
  subtitle?: string;
  exercises: WorkoutExercise[];
  onPick: (ex: WorkoutExercise) => void;
  completedIds?: Set<string>;
  onToggle?: (key: string) => void;
  defaultOpen?: boolean;
}

function exerciseKey(ex: WorkoutExercise, index: number): string {
  return `${ex.ordem}-${ex.exercicio}-${index}`;
}

export function WorkoutBlockCard({
  title,
  subtitle,
  exercises,
  onPick,
  completedIds,
  onToggle,
  defaultOpen = true,
}: WorkoutBlockCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!exercises || exercises.length === 0) return null;

  const total = exercises.length;
  const completed = exercises.filter((_, i) => completedIds?.has(exerciseKey(exercises[i], i))).length;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <Dumbbell className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p
              className="font-bold text-sm text-foreground truncate"
              style={{ fontFamily: "Archivo, sans-serif" }}
            >
              {title}
            </p>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {completed}/{total} concluídos
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {exercises.map((ex, i) => {
            const key = exerciseKey(ex, i);
            return (
              <WorkoutExerciseItem
                key={key}
                exercise={ex}
                onClick={() => onPick(ex)}
                completed={completedIds?.has(key)}
                onToggle={onToggle ? () => onToggle(key) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
