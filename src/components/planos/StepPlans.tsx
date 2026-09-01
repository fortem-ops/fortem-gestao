import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock } from "lucide-react";
import {
  PLANOS,
  formatBRL,
  getFrequencia,
  nomePlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  value: PlanoId | null;
  onSelect: (plano: PlanoId) => void;
}

/** Etapa 2: horário livre x horário ocioso para a frequência escolhida. */
const StepPlans = ({ frequencia, value, onSelect }: Props) => (
  <div className="space-y-6">
    <div className="text-center">
      <h2 className="text-2xl sm:text-3xl font-bold">Escolhe o teu plano</h2>
      <p className="mt-2 text-muted-foreground">
        Valores para <strong>{getFrequencia(frequencia).label}</strong>.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
      {PLANOS.map((p) => {
        const selected = value === p.id;
        const nome = nomePlano(frequencia, p.id);
        return (
          <Card
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(p.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p.id)}
            className={`p-5 flex flex-col cursor-pointer transition-all hover:border-primary/60 ${
              selected ? "border-primary ring-1 ring-primary" : p.highlighted ? "border-primary/50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2 min-h-6">
              <h3 className="text-xl font-bold">{nome}</h3>
              {p.tag && (
                <Badge variant={p.highlighted ? "default" : "secondary"} className="text-[10px]">
                  {p.tag}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>

            <p className="mt-4">
              <span className="text-3xl font-bold">{formatBRL(precoDe(frequencia, p.id))}</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </p>

            {p.horario ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Clock className="h-3.5 w-3.5" />
                {p.horario}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Qualquer horário de funcionamento</p>
            )}

            <ul className="mt-4 space-y-1.5 flex-1">
              {p.beneficios.map((b) => (
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
                onSelect(p.id);
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

export default StepPlans;
