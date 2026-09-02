import { Button } from "@/components/ui/button";

export type ResultadoView =
  | "assimetria"
  | "composicao"
  | "pliometria"
  | "evolucao"
  | "comparativo"
  | "recomendacoes";

interface Props {
  view: ResultadoView;
  onChange: (view: ResultadoView) => void;
}

const OPTIONS: Array<{ id: ResultadoView; label: string }> = [
  { id: "assimetria", label: "Assimetrias" },
  { id: "composicao", label: "Composição" },
  { id: "pliometria", label: "Pliometria" },
  { id: "evolucao", label: "Evolução" },
  { id: "comparativo", label: "Comparativo" },
  { id: "recomendacoes", label: "Recomendações" },
];

export function ResultadosNav({ view, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-line)/0.25)] p-1.5"
      aria-label="Seções dos resultados"
    >
      {OPTIONS.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(option.id)}
          className={`h-9 rounded-md px-3 text-sm font-semibold ${
            view === option.id
              ? "bg-primary/20 text-[hsl(var(--bio-ink))] ring-1 ring-primary/40"
              : "text-[hsl(var(--bio-ink-muted))] hover:bg-[hsl(var(--bio-line)/0.5)] hover:text-[hsl(var(--bio-ink))]"
          }`}
          aria-pressed={view === option.id}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

