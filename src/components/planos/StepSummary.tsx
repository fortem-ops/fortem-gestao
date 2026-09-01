import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import WhatsAppCta from "./WhatsAppCta";
import {
  RECORRENCIA_EXTRA,
  formatBRL,
  getFrequencia,
  getPlano,
  precoDe,
  precoFinal,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  plano: PlanoId;
  recorrencia: boolean;
  onRecorrenciaChange: (v: boolean) => void;
}

/** Etapa 3: resumo da escolha e conversão via WhatsApp. */
const StepSummary = ({ frequencia, plano, recorrencia, onRecorrenciaChange }: Props) => {
  const def = getPlano(plano);
  const base = precoDe(frequencia, plano);
  const total = precoFinal(frequencia, plano, recorrencia);

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
          <span className="font-medium">{def.nome}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Valor do plano</span>
          <span className="font-medium">{formatBRL(base)}/mês</span>
        </div>

        {def.recorrenciaNativa ? (
          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            O {def.nome} já é recorrência mensal, sem fidelidade e sem taxa adicional.
          </p>
        ) : (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="recorrencia" className="text-sm font-medium">
                Quero recorrência mensal (sem fidelidade de 12 meses)
              </Label>
              <Switch id="recorrencia" checked={recorrencia} onCheckedChange={onRecorrenciaChange} />
            </div>
            <p className="text-xs text-muted-foreground">
              Adicional de {formatBRL(RECORRENCIA_EXTRA)}/mês sobre o valor do plano.
            </p>
          </div>
        )}

        <div className="flex items-end justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total mensal</span>
          <span className="text-3xl font-bold">
            {formatBRL(total)}
            <span className="text-sm font-normal text-muted-foreground">/mês</span>
          </span>
        </div>
      </Card>

      <WhatsAppCta frequencia={frequencia} plano={plano} recorrencia={recorrencia} />
      <p className="text-center text-xs text-muted-foreground">
        Tu serás redirecionado ao WhatsApp da Fortem com o resumo da tua escolha.
      </p>
    </div>
  );
};

export default StepSummary;
