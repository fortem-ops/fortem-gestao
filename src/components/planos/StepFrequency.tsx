import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import {
  FREQUENCIAS,
  PROXIMA_FREQUENCIA,
  formatBRL,
  getFrequencia,
  precoMinimoDaFrequencia,
  type FrequenciaPlano,
} from "@/data/planosPricing";

interface Props {
  value: FrequenciaPlano | null;
  onSelect: (freq: FrequenciaPlano) => void;
}

/** Etapa 1: escolha da frequência semanal + upsell de mais um treino. */
const StepFrequency = ({ value, onSelect }: Props) => {
  const proxima = value ? PROXIMA_FREQUENCIA[value] : undefined;
  const diferenca =
    value && proxima ? precoMinimoDaFrequencia(proxima) - precoMinimoDaFrequencia(value) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Quantas vezes por semana tu queres treinar?</h2>
        <p className="mt-2 text-muted-foreground">A frequência define os valores dos planos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FREQUENCIAS.map((f) => {
          const selected = value === f.id;
          return (
            <Card
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(f.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(f.id)}
              className={`p-5 cursor-pointer transition-all hover:border-primary/60 ${
                selected ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{f.label}</h3>
                  <p className="text-sm text-muted-foreground">{f.descricao}</p>
                </div>
                {f.destaque && <Badge>Mais escolhido</Badge>}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                a partir de{" "}
                <span className="text-xl font-bold text-foreground">
                  {formatBRL(precoMinimoDaFrequencia(f.id))}
                </span>
                /mês
              </p>
            </Card>
          );
        })}
      </div>

      {value && proxima && (
        <Card className="p-4 border-primary/40 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">
                Adicionar mais um treino semanal:{" "}
                <strong>{getFrequencia(proxima).label}</strong> por apenas{" "}
                <strong>+{formatBRL(diferenca)}</strong>/mês.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onSelect(proxima)}>
              Quero {getFrequencia(proxima).label}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default StepFrequency;
