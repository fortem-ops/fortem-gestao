import { ATIVIDADE_CONFIG, ATIVIDADE_TIPOS, type TipoAtividade } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface Props {
  value: TipoAtividade;
  onChange: (v: TipoAtividade) => void;
  className?: string;
}

export function AtividadeTipoSelector({ value, onChange, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {ATIVIDADE_TIPOS.map((tipo) => {
        const cfg = ATIVIDADE_CONFIG[tipo];
        const Icon = cfg.icon;
        const active = value === tipo;
        return (
          <button
            key={tipo}
            type="button"
            onClick={() => onChange(tipo)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors",
              active
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-transparent border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
