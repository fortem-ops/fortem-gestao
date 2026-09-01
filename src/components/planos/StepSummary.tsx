import { Card } from "@/components/ui/card";
import WhatsAppCta from "./WhatsAppCta";
import {
  formatBRL,
  getFrequencia,
  getPlano,
  nomePlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  plano: PlanoId;
}

/** Etapa 3: resumo da escolha e conversão via WhatsApp. */
const StepSummary = ({ frequencia, plano }: Props) => {
  const def = getPlano(plano);
  const total = precoDe(frequencia, plano);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Teu plano está pronto</h2>
        <p className="mt-2 text-muted-foreground">Confere o resumo e fala com a nossa equipe.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frequência</span>
          <span className="font-medium">{getFrequencia(frequencia).label}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Plano</span>
          <span className="font-medium">{nomePlano(frequencia, plano)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Horário</span>
          <span className="font-medium">{def.horario ?? "Livre"}</span>
        </div>

        <div className="flex items-end justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total mensal</span>
          <span className="text-3xl font-bold">
            {formatBRL(total)}
            <span className="text-sm font-normal text-muted-foreground">/mês</span>
          </span>
        </div>
      </Card>

      <WhatsAppCta frequencia={frequencia} plano={plano} />
      <p className="text-center text-xs text-muted-foreground">
        Tu serás redirecionado ao WhatsApp da Fortem com o resumo da tua escolha.
      </p>
    </div>
  );
};

export default StepSummary;
