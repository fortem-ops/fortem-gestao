import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCobrancasContrato, useRegistrarPagamento } from '@/hooks/useContratos';
import { Cobranca, formatBRL } from '@/types/financeiro';

interface Props {
  contratoId: string;
  canRegister?: boolean;
}

export function TimelineCobrancas({ contratoId, canRegister = false }: Props) {
  const { data: cobrancas, isLoading } = useCobrancasContrato(contratoId);
  const [selecionada, setSelecionada] = useState<Cobranca | null>(null);

  if (isLoading) {
    return <div className="py-6 text-center text-muted-foreground text-sm">Carregando cobranças...</div>;
  }
  if (!cobrancas?.length) {
    return <div className="py-6 text-center text-muted-foreground text-sm">Nenhuma cobrança registrada.</div>;
  }

  return (
    <>
      <ol className="relative border-l border-border ml-3 space-y-4">
        {cobrancas.map((c) => {
          const meta = STATUS_META[c.status];
          return (
            <li key={c.id} className="ml-6">
              <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.bg}`}>
                <meta.icon className="h-3.5 w-3.5 text-white" />
              </span>
              <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    Ciclo {c.numero_ciclo} · {formatBRL(c.valor)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {formatDate(c.data_vencimento)}
                    {c.data_pagamento && ` · Pago em ${formatDate(c.data_pagamento)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                  {canRegister && (c.status === 'pendente' || c.status === 'atrasado') && (
                    <Button size="sm" variant="outline" onClick={() => setSelecionada(c)}>
                      Registrar pagamento
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {selecionada && (
        <RegistrarPagamentoDialog
          cobranca={selecionada}
          onClose={() => setSelecionada(null)}
        />
      )}
    </>
  );
}

function RegistrarPagamentoDialog({ cobranca, onClose }: { cobranca: Cobranca; onClose: () => void }) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [comprovante, setComprovante] = useState('');
  const registrar = useRegistrarPagamento();

  const handleSubmit = async () => {
    await registrar.mutateAsync({
      cobrancaId: cobranca.id,
      dataPagamento,
      comprovante_url: comprovante || undefined,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento — Ciclo {cobranca.numero_ciclo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Valor: </span>
            <span className="font-semibold">{formatBRL(cobranca.valor)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">Data do pagamento</Label>
            <Input id="data" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp">URL do comprovante (opcional)</Label>
            <Input id="comp" value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={registrar.isPending}>
            {registrar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_META = {
  pago:      { icon: CheckCircle2, bg: 'bg-green-500',   text: 'text-green-600 dark:text-green-400',   label: 'Pago' },
  pendente:  { icon: Clock,        bg: 'bg-muted-foreground', text: 'text-muted-foreground',           label: 'Pendente' },
  atrasado:  { icon: AlertCircle,  bg: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',       label: 'Atrasado' },
  cancelado: { icon: XCircle,      bg: 'bg-muted-foreground', text: 'text-muted-foreground',           label: 'Cancelado' },
  isento:    { icon: CheckCircle2, bg: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',     label: 'Isento' },
} as const;

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}
