import { useState } from 'react';
import { Calendar, CreditCard, Zap, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DialogRescisao } from './DialogRescisao';
import { useCiclosCredito } from '@/hooks/useContratos';
import {
  Contrato, PLANO_LABELS, FREQUENCIA_LABELS, FORMA_PAGAMENTO_LABELS,
  STATUS_CONTRATO_LABELS, formatBRL, ContratoStatus,
} from '@/types/financeiro';

const STATUS_VARIANT: Record<ContratoStatus, string> = {
  ativo:         'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  suspenso:      'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  inadimplente:  'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  cancelado:     'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  encerrado:     'bg-muted text-muted-foreground border-border',
};

export function CardContrato({ contrato }: { contrato: Contrato }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: ciclos } = useCiclosCredito(contrato.id);
  const cicloAtivo = ciclos?.find((c) => c.status === 'ativo');

  const podeCancelar = contrato.status === 'ativo' || contrato.status === 'suspenso';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">{PLANO_LABELS[contrato.plano_tipo]}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {FREQUENCIA_LABELS[contrato.frequencia_semanal]} · {contrato.vigencia_tipo === 'anual' ? 'Anual' : 'Mensal'}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_VARIANT[contrato.status]}>
            {STATUS_CONTRATO_LABELS[contrato.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info icon={CreditCard} label="Valor" value={formatBRL(contrato.valor_cobrado)} sub={FORMA_PAGAMENTO_LABELS[contrato.forma_pagamento]} />
            <Info icon={Calendar} label="Próxima cobrança"
              value={contrato.data_renovacao ? formatDate(contrato.data_renovacao) : '—'} />
          </div>

          {cicloAtivo && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Créditos do ciclo
                </span>
                <span className="font-medium">
                  {cicloAtivo.creditos_usados} / {cicloAtivo.creditos_liberados}
                </span>
              </div>
              <Progress
                value={cicloAtivo.creditos_liberados > 0
                  ? (cicloAtivo.creditos_usados / cicloAtivo.creditos_liberados) * 100
                  : 0}
              />
            </div>
          )}

          {podeCancelar && (
            <Button variant="outline" className="w-full" onClick={() => setDialogOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Solicitar cancelamento
            </Button>
          )}
        </CardContent>
      </Card>

      <DialogRescisao contrato={contrato} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

function Info({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="font-medium">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}
