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
}

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
}: Props) {
  const max = todayISO();
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs text-white/65 flex items-center gap-1.5">
        <CalendarIcon className="w-3.5 h-3.5" /> {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 bg-white/5 border-white/10 text-white w-full md:w-56"
      />
      {helperText && (
        <p className="text-[10px] text-white/45 mt-1">{helperText}</p>
      )}
    </div>
  );
}
