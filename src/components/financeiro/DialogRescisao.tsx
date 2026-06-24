import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCalcularRescisao, useCancelarContrato } from '@/hooks/useContratos';
import {
  Contrato, FORMA_PAGAMENTO_LABELS, PLANO_LABELS, FREQUENCIA_LABELS, formatBRL,
} from '@/types/financeiro';

interface Props {
  contrato: Contrato;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
}

export function DialogRescisao({ contrato, open, onOpenChange, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('');
  const { data: rescisao, isLoading } = useCalcularRescisao(contrato.id, open);
  const cancelar = useCancelarContrato();

  const handleConfirmar = async () => {
    await cancelar.mutateAsync({ id: contrato.id, motivo: motivo || undefined });
    onOpenChange(false);
    onConfirm?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Solicitação de cancelamento do contrato
          </DialogTitle>
          <DialogDescription>
            Revise os valores abaixo antes de confirmar. O cancelamento é irreversível.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !rescisao ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seção 1 — Dados do contrato */}
            <section className="rounded-lg border p-4 space-y-1.5 text-sm">
              <h3 className="font-semibold text-base mb-2">Resumo do contrato</h3>
              <div className="grid grid-cols-2 gap-2">
                <Info label="Plano" value={PLANO_LABELS[contrato.plano_tipo]} />
                <Info label="Frequência" value={FREQUENCIA_LABELS[contrato.frequencia_semanal]} />
                <Info label="Início" value={formatDate(contrato.data_inicio)} />
                <Info label="Fim previsto" value={contrato.data_fim ? formatDate(contrato.data_fim) : '—'} />
                {rescisao.mes_atual !== undefined && (
                  <>
                    <Info label="Mês atual" value={`${rescisao.mes_atual}º`} />
                    <Info label="Meses restantes" value={String(rescisao.meses_restantes ?? 0)} />
                  </>
                )}
                <Info label="Valor" value={formatBRL(contrato.valor_cobrado)} />
                <Info label="Pagamento" value={FORMA_PAGAMENTO_LABELS[contrato.forma_pagamento]} />
              </div>
            </section>

            {/* Seção 2 — Cálculo */}
            <section className="rounded-lg border p-4 space-y-2 text-sm">
              <h3 className="font-semibold text-base mb-2">Cálculo da rescisão</h3>
              {rescisao.tipo === 'start_sem_multa' && (
                <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-green-700 dark:text-green-400">
                  Plano mensal sem fidelidade. <strong>Nenhuma multa devida.</strong>
                </div>
              )}

              {rescisao.tipo === 'recorrencia_com_multa' && (
                <div className="space-y-1.5">
                  <Linha label="Mensalidades vincendas" value={formatBRL(rescisao.valor_vincendo)} />
                  <Linha label={`Multa (${rescisao.percentual_multa}%)`} value={formatBRL(rescisao.multa_base)} />
                  {(rescisao.servicos_vincendos ?? 0) > 0 && (
                    <Linha label="Serviços parcelados vincendos" value={formatBRL(rescisao.servicos_vincendos)} />
                  )}
                  <Separator className="my-2" />
                  <Linha label="Total devido" value={formatBRL(rescisao.total_devido)} highlight="danger" />
                </div>
              )}

              {rescisao.tipo === 'parcelado_com_restituicao' && (
                <div className="space-y-1.5">
                  <Linha label="Valor total do contrato" value={formatBRL(rescisao.valor_total_contrato)} />
                  <Linha label="Proporcional restante" value={formatBRL(rescisao.valor_proporcional)} />
                  <Linha label={`Restituição (${rescisao.percentual_restituicao}%)`} value={formatBRL(rescisao.restituicao_bruta)} />
                  {(rescisao.deducao_servicos ?? 0) > 0 && (
                    <Linha label="Dedução serviços utilizados" value={`- ${formatBRL(rescisao.deducao_servicos)}`} />
                  )}
                  <Separator className="my-2" />
                  {rescisao.total_restituir > 0 ? (
                    <Linha label="A restituir ao aluno" value={formatBRL(rescisao.total_restituir)} highlight="success" />
                  ) : (
                    <Linha label="Saldo devedor do aluno" value={formatBRL(rescisao.total_devido)} highlight="danger" />
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-2 border-t mt-2">{rescisao.descricao}</p>
            </section>

            {/* Seção 3 — Condições pós-cancelamento */}
            <section className="rounded-lg border p-4 space-y-1 text-sm">
              <h3 className="font-semibold text-base mb-2">Condições após o cancelamento</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Acesso mantido até o fim do ciclo já pago.</li>
                <li>Créditos não utilizados serão suspensos.</li>
                <li>Cobranças recorrentes futuras serão interrompidas.</li>
                {rescisao.total_devido > 0 && (
                  <li className="text-destructive font-medium">Saldo devedor de {formatBRL(rescisao.total_devido)} deverá ser quitado.</li>
                )}
                {rescisao.total_restituir > 0 && (
                  <li className="text-green-600 dark:text-green-400 font-medium">
                    Restituição de {formatBRL(rescisao.total_restituir)} será processada em até 10 dias úteis.
                  </li>
                )}
              </ul>
            </section>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo do cancelamento (opcional)</label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: mudança de cidade, motivos financeiros..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancelar.isPending}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={isLoading || cancelar.isPending}
          >
            {cancelar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Linha({ label, value, highlight }: { label: string; value: string; highlight?: 'danger' | 'success' }) {
  const cls =
    highlight === 'danger' ? 'text-destructive font-bold' :
    highlight === 'success' ? 'text-green-600 dark:text-green-400 font-bold' :
    '';
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls || 'font-medium'}>{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}
