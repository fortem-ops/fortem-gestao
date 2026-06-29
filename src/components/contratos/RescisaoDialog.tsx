import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertTriangle,
  CalendarX,
  CreditCard,
  Coins,
  Ban,
  Loader2,
  RotateCcw,
  FilePlus,
} from "lucide-react";
import {
  calcRescisao,
  LABEL_PLANO,
  LABEL_PAGAMENTO,
  type Contrato,
  type ServicoUtilizado,
} from "@/lib/contratos-calc";

export type TratamentoMulta = "estorno" | "nova_cobranca";

export interface CancelamentoPayload {
  dataCancelamento: string;
  valorMulta: number;
  tratamento: TratamentoMulta;
  vencimentoMulta?: string;
}

interface Props {
  contrato: Contrato;
  servicosUtilizados: ServicoUtilizado[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmar: (payload: CancelamentoPayload) => Promise<void>;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FORMAS_RECORRENCIA = new Set(["cartao_recorrencia", "pix_automatico"]);

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function RescisaoDialog({
  contrato,
  servicosUtilizados,
  open,
  onOpenChange,
  onConfirmar,
}: Props) {
  const hoje = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);
  const [dataCancelamento, setDataCancelamento] = useState(hoje);
  const r = calcRescisao(contrato, servicosUtilizados);

  const multaCalculada = useMemo(() => {
    if (r.tipo === "recorrencia_com_multa") return r.total_devido;
    if (r.tipo === "parcelado_com_restituicao") return r.saldo_devedor ?? 0;
    return 0;
  }, [r]);

  const [valorMultaStr, setValorMultaStr] = useState<string>(
    multaCalculada > 0 ? multaCalculada.toFixed(2) : "0.00",
  );
  const [vencimentoMulta, setVencimentoMulta] = useState<string>(addDays(hoje, 7));

  const valorMulta = Number(valorMultaStr.replace(",", ".")) || 0;
  const isRecorrencia = FORMAS_RECORRENCIA.has(contrato.forma_pagamento);
  const tratamento: TratamentoMulta = isRecorrencia ? "nova_cobranca" : "estorno";

  const isFutura = dataCancelamento > hoje;
  const temMulta = valorMulta > 0;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmar({
        dataCancelamento,
        valorMulta,
        tratamento,
        vencimentoMulta: tratamento === "nova_cobranca" ? vencimentoMulta : undefined,
      });
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
            Revise as condições, defina a data efetiva e o tratamento da multa.
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
              <span className="font-semibold">Multa calculada</span>
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

        {/* Seção 3 — Data efetiva */}
        <Card className="p-4 space-y-2">
          <Label htmlFor="data-cancel" className="flex items-center gap-2 text-sm font-medium">
            <CalendarX className="h-4 w-4 text-yellow-500" /> Data efetiva do cancelamento
          </Label>
          <Input
            id="data-cancel"
            type="date"
            value={dataCancelamento}
            min={undefined}
            onChange={(e) => setDataCancelamento(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {isFutura
              ? "Data futura: o cancelamento será agendado e refletido em Plano/Serviços."
              : "Cancelamento efetivado imediatamente."}
          </p>
        </Card>

        {/* Seção 4 — Multa editável + tratamento */}
        {r.tipo !== "start_sem_multa" && (
          <Card className="p-4 space-y-3">
            <Label htmlFor="valor-multa" className="text-sm font-medium">
              Ajustar multa (R$)
            </Label>
            <Input
              id="valor-multa"
              type="number"
              min="0"
              step="0.01"
              value={valorMultaStr}
              onChange={(e) => setValorMultaStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor calculado: {fmt(multaCalculada)}. Edite se houver negociação.
            </p>

            {temMulta && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Como tratar a multa</div>
                  {tratamento === "estorno" ? (
                    <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                      <RotateCcw className="h-4 w-4 text-blue-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-blue-200">
                          Estorno automático de {fmt(valorMulta)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Pagamento tradicional ({LABEL_PAGAMENTO[contrato.forma_pagamento]}): registramos o estorno no histórico de cobranças.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <FilePlus className="h-4 w-4 text-orange-400 mt-0.5" />
                        <div>
                          <div className="font-medium text-orange-200">
                            Nova cobrança de multa de {fmt(valorMulta)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Recorrência ({LABEL_PAGAMENTO[contrato.forma_pagamento]}): será gerada uma cobrança pendente para o aluno pagar a multa.
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="venc-multa" className="text-xs">
                          Vencimento da cobrança da multa
                        </Label>
                        <Input
                          id="venc-multa"
                          type="date"
                          value={vencimentoMulta}
                          onChange={(e) => setVencimentoMulta(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        {/* Seção 5 — Condições */}
        <Card className="p-4 space-y-2 text-sm">
          <h4 className="font-medium mb-2">Após o cancelamento</h4>
          <Condicao
            icon={<CalendarX className="h-4 w-4 text-yellow-500" />}
            text="Acesso mantido até a data efetiva do cancelamento."
          />
          <Condicao
            icon={<CreditCard className="h-4 w-4 text-blue-400" />}
            text="Cobranças pendentes posteriores à data serão canceladas automaticamente."
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
            {isFutura ? "Agendar cancelamento" : "Confirmar cancelamento"}
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
