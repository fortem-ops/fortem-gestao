import { Check } from "lucide-react";
import { motion } from "framer-motion";

export interface StepDef {
  id: string;
  label: string;
}

interface Props {
  steps: StepDef[];
  current: number; // index in steps
  onStepClick?: (index: number) => void;
}

/**
 * Stepper dinâmico do wizard /corrida: bolinhas numeradas, check verde ao
 * concluir, linha conectora animada e etapa atual com pulse.
 */
const CorridaStepper = ({ steps, current, onStepClick }: Props) => (
  <div className="w-full">
    <div className="flex items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onStepClick;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div className="absolute top-4 right-1/2 left-[-50%] h-0.5 bg-border overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: done || active ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ originX: 0 }}
                  className="h-full bg-primary"
                />
              </div>
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary bg-background animate-pulse"
                    : "border-border text-muted-foreground bg-background"
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span
              className={`mt-2 text-[10px] sm:text-xs text-center leading-tight ${
                active ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default CorridaStepper;
