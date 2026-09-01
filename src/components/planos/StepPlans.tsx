import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import {
  PLANOS,
  PROXIMO_PLANO,
  formatBRL,
  getFrequencia,
  getPlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  value: PlanoId | null;
  onSelect: (plano: PlanoId) => void;
}

/** Etapa 2: cards dos 5 planos + upgrade inteligente. */
const StepPlans = ({ frequencia, value, onSelect }: Props) => {
  const upgrade = value ? PROXIMO_PLANO[value] : undefined;
  const diferenca =
    value && upgrade ? precoDe(frequencia, upgrade) - precoDe(frequencia, value) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Escolhe o teu plano</h2>
        <p className="mt-2 text-muted-foreground">
          Valores para <strong>{getFrequencia(frequencia).label}</strong>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLANOS.map((p) => {
          const selected = value === p.id;
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
                <h3 className="text-xl font-bold">{p.nome}</h3>
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
              <p className="text-xs text-muted-foreground">
                {p.recorrenciaNativa ? "Recorrência mensal, sem fidelidade" : "Fidelidade 12 meses"}
              </p>

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
                {selected ? "Selecionado" : `Escolher ${p.nome}`}
              </Button>
            </Card>
          );
        })}
      </div>

      {value && upgrade && (
        <Card className="p-4 border-primary/40 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">
                Upgrade inteligente: por <strong>+{formatBRL(diferenca)}</strong>/mês tu passas para o{" "}
                <strong>{getPlano(upgrade).nome}</strong> — {getPlano(upgrade).descricao}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onSelect(upgrade)}>
              Quero o {getPlano(upgrade).nome}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default StepPlans;
