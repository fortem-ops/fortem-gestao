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
  { id: "assimetria", label: "Assimetria" },
  { id: "composicao", label: "Composição" },
  { id: "pliometria", label: "Pliometria" },
  { id: "evolucao", label: "Evolução" },
  { id: "comparativo", label: "Comparativo" },
  { id: "recomendacoes", label: "Recomendações" },
];

export function ResultadosNav({ view, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1"
      aria-label="Seções dos resultados"
    >
      {OPTIONS.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(option.id)}
          className={`h-8 rounded-md px-2.5 text-xs font-medium ${
            view === option.id
              ? "bg-white/10 text-white"
              : "text-white/55 hover:bg-white/5 hover:text-white/80"
          }`}
          aria-pressed={view === option.id}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
