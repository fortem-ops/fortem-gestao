import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ResultadosDateOption {
  date: string;
  categories: string[];
}

interface Props {
  options: ResultadosDateOption[];
  value: string;
  onChange: (date: string) => void;
}

export function ResultadosDateSelect({ options, value, onChange }: Props) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[hsl(var(--bio-ink-muted))]" />
        <div>
          <p className="bio-label">Data dos resultados</p>
          <p className="text-xs text-[hsl(var(--bio-ink-muted))]">Mapa e categorias</p>
        </div>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Selecionar data dos resultados"
          className="h-9 w-[240px] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]"
        >
          <SelectValue placeholder="Selecione uma data" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.date} value={option.date}>
              <span className="flex items-center gap-2">
                <span>{format(parseISO(option.date), "dd/MM/yyyy")}</span>
                <span className="text-xs text-[hsl(var(--bio-ink-muted))]">
                  · {option.categories.join(" · ")}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
