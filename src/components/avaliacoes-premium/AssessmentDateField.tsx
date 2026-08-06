import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  helperText?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /**
   * "dark" (padrão) mantém a aparência do formulário legado de avaliações.
   * "light" é usado dentro da tela Avaliações Premium (tema claro).
   */
  theme?: "dark" | "light";
}

const THEME = {
  dark: {
    label: "text-white/65",
    input: "bg-white/5 border-white/10 text-white",
    helper: "text-white/45",
  },
  light: {
    label: "text-[hsl(var(--bio-ink-muted))]",
    input:
      "bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]",
    helper: "text-[hsl(var(--bio-ink-faint))]",
  },
} as const;

/**
 * Campo compartilhado de data para lançamento retroativo de avaliações.
 * Aceita qualquer data no passado, bloqueia datas futuras (max = hoje).
 */
export function AssessmentDateField({
  value,
  onChange,
  label = "Data da avaliação",
  helperText = "Você pode registrar uma data no passado (lançamento retroativo).",
  className,
  id = "assessment-date",
  disabled,
  theme = "dark",
}: Props) {
  const max = todayISO();
  const tone = THEME[theme];
  return (
    <div className={className}>
      <Label htmlFor={id} className={`text-xs ${tone.label} flex items-center gap-1.5`}>
        <CalendarIcon className="w-3.5 h-3.5" /> {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 h-9 w-full md:w-56 ${tone.input}`}
      />
      {helperText && <p className={`text-[10px] ${tone.helper} mt-1`}>{helperText}</p>}
    </div>
  );
}
