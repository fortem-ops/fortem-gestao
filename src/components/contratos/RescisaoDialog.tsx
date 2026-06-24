import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  CalendarX,
  CreditCard,
  Coins,
  Ban,
  Loader2,
} from "lucide-react";
import {
  calcRescisao,
  LABEL_PLANO,
  LABEL_PAGAMENTO,
  type Contrato,
  type ServicoUtilizado,
} from "@/lib/contratos-calc";

interface Props {
  contrato: Contrato;
  servicosUtilizados: ServicoUtilizado[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmar: () => Promise<void>;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RescisaoDialog({
  contrato,
  servicosUtilizados,
  open,
  onOpenChange,
  onConfirmar,
}: Props) {
  const [loading, setLoading] = useState(false);
  const r = calcRescisao(contrato, servicosUtilizados);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmar();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelamento de Contrato</DialogTitle>
          <DialogDescription>
            Revise as condições de rescisão antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Seção 1 — Dados do contrato */}
        <Card className="p-4 space-y-2 bg-secondary/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Plano" value={LABEL_PLANO[contrato.plano_tipo]} />
            <Info
              label="Vigência"
              value={contrato.vigencia_tipo === "anual" ? "Anual (12 meses)" : "Mensal"}
            />
            <Info label="Mês atual" value={`${r.mes_atual || 1}º`} />
            <Info label="Meses restantes" value={String(r.meses_restantes)} />
            <Info label="Valor mensal" value={fmt(contrato.valor_cobrado)} />
            <Info label="Pagamento" value={LABEL_PAGAMENTO[contrato.forma_pagamento]} />
          </div>
        </Card>

        {/* Seção 2 — Cálculo rescisório */}
        {r.tipo === "start_sem_multa" && (
          <Alert className="border-green-600/40 bg-green-600/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-200">
              Sem multa de cancelamento. Acesso mantido até o fim do ciclo pago.
            </AlertDescription>
          </Alert>
        )}

        {r.tipo === "recorrencia_com_multa" && (
          <Card className="p-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Multa de cancelamento — Recorrência
            </h4>
            <Separator />
            <Row label="Mensalidades vincendas" value={fmt(r.valor_vincendo ?? 0)} />
            <Row label={`Percentual de multa (mês ${r.mes_atual})`} value={`${r.percentual}%`} />
            <Row label="Multa sobre vincendas" value={fmt(r.multa_base ?? 0)} />
            <Row label="Serviços vincendos (proporcional)" value={fmt(r.servicos_vincendos ?? 0)} />
            <Separator />
            <div className="flex justify-between items-center pt-1">
              <span className="font-semibold">Total a pagar</span>
              <span className="text-lg font-bold text-red-500">{fmt(r.total_devido)}</span>
            </div>
          </Card>
        )}

        {r.tipo === "parcelado_com_restituicao" && (
          <Card className="p-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-green-500" />
              Restituição — Parcelado
            </h4>
            <Separator />
            <Row label="Valor total do contrato" value={fmt(r.valor_total_contrato ?? 0)} />
            <Row label="Valor proporcional aos meses restantes" value={fmt(r.valor_proporcional ?? 0)} />
            <Row label={`Restituição (${r.percentual}%)`} value={fmt(r.restituicao_bruta ?? 0)} />
            <Row label="Dedução de serviços usados" value={`- ${fmt(r.deducao_servicos ?? 0)}`} />
            <Separator />
            {r.total_restituir > 0 ? (
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold">Valor a restituir</span>
                <span className="text-lg font-bold text-green-500">
                  {fmt(r.total_restituir)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold">Saldo devedor</span>
                <span className="text-lg font-bold text-red-500">
                  {fmt(r.saldo_devedor ?? 0)}
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Seção 3 — Condições */}
        <Card className="p-4 space-y-2 text-sm">
          <h4 className="font-medium mb-2">Após o cancelamento</h4>
          <Condicao
            icon={<CalendarX className="h-4 w-4 text-yellow-500" />}
            text="Acesso mantido até o fim do ciclo já pago."
          />
          <Condicao
            icon={<CreditCard className="h-4 w-4 text-blue-400" />}
            text="Cobranças futuras pendentes serão canceladas automaticamente."
          />
          <Condicao
            icon={<Coins className="h-4 w-4 text-purple-400" />}
            text="Créditos restantes do ciclo ativo serão suspensos."
          />
          <Condicao
            icon={<Ban className="h-4 w-4 text-red-400" />}
            text="Serviços já utilizados (nutrição, fisioterapia) não são reembolsáveis."
          />
        </Card>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Condicao({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
