import { Check } from "lucide-react";

export const ETAPAS = ["Frequência", "Plano", "Resumo"] as const;

interface Props {
  current: number;
  onStepClick?: (index: number) => void;
}

/** Indicador das 3 etapas do funil /planos. Etapas concluídas são clicáveis. */
const ProgressBar = ({ current, onStepClick }: Props) => (
  <div className="w-full max-w-md mx-auto">
    <div className="flex items-start">
      {ETAPAS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onStepClick;
        return (
          <div key={label} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div className="absolute top-4 right-1/2 left-[-50%] h-0.5 bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-transform duration-300 origin-left"
                  style={{ transform: `scaleX(${done || active ? 1 : 0})` }}
                />
              </div>
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              aria-current={active ? "step" : undefined}
              className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary bg-background"
                    : "border-border text-muted-foreground bg-background"
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span
              className={`mt-2 text-[11px] sm:text-xs text-center ${
                active ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default ProgressBar;
