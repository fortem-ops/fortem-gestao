import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock } from "lucide-react";
import {
  BENEFICIOS,
  formatBRL,
  getFrequencia,
  getPlano,
  nomePlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

export interface SelecaoPlano {
  frequencia: FrequenciaPlano;
  plano: PlanoId;
}

interface Props {
  value: SelecaoPlano | null;
  onSelect: (selecao: SelecaoPlano) => void;
}

/** Todos os planos e valores em uma única grade. */
const PlanosGrid = ({ value, onSelect }: Props) => {
  // Ordem solicitada: 2x HR, 2x, 3x HR, 3x
  const opcoes = [
    { freq: getFrequencia("2x"), plano: getPlano("ocioso") },
    { freq: getFrequencia("2x"), plano: getPlano("padrao") },
    { freq: getFrequencia("3x"), plano: getPlano("ocioso") },
    { freq: getFrequencia("3x"), plano: getPlano("padrao") },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Planos e valores</h2>
        <p className="mt-2 text-muted-foreground">
          Escolhe a frequência e o horário que combinam com a tua rotina.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {opcoes.map(({ freq, plano }) => {
          const selected = value?.frequencia === freq.id && value?.plano === plano.id;
          const destaque = freq.destaque && plano.highlighted;
          const nome = nomePlano(freq.id, plano.id);
          const selecionar = () => onSelect({ frequencia: freq.id, plano: plano.id });

          return (
            <Card
              key={`${freq.id}-${plano.id}`}
              role="button"
              tabIndex={0}
              onClick={selecionar}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selecionar()}
              className={`p-5 flex flex-col cursor-pointer transition-all hover:border-primary/60 ${
                selected ? "border-primary ring-1 ring-primary" : destaque ? "border-primary/50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2 min-h-6">
                <h3 className="text-lg font-bold leading-tight">{nome}</h3>
                {destaque && <Badge className="text-[10px] shrink-0">Mais escolhido</Badge>}
                {!destaque && plano.id === "ocioso" && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    Melhor valor
                  </Badge>
                )}
              </div>

              <p className="mt-4">
                <span className="text-3xl font-bold">{formatBRL(precoDe(freq.id, plano.id))}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </p>

              {plano.horario ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Clock className="h-3.5 w-3.5" />
                  {plano.horario}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Qualquer horário de funcionamento</p>
              )}

              <ul className="mt-4 space-y-1.5 flex-1">
                {BENEFICIOS.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5 w-full"
                variant={selected ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  selecionar();
                }}
              >
                {selected ? "Selecionado" : "Escolher este plano"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PlanosGrid;
