import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/vendas";
import { BANDEIRAS_PADRAO, type Bandeira } from "@/types/adquirente";
import {
  FORMAS_RECEBIMENTO,
  formaExigeBandeira,
  formaPermiteParcelas,
} from "@/lib/formasRecebimento";

type Props = {
  aberto: boolean;
  onToggle: () => void;
  valorCatalogoRef: number;
  valorManual: string;
  onValorManualChange: (v: string) => void;
  dataVenda: string;
  onDataVendaChange: (d: string) => void;
  jaPago: boolean;
  onJaPagoChange: (v: boolean) => void;
  avisoRecorrencia?: boolean;
  formaRecebimento: string;
  onFormaRecebimentoChange: (v: string) => void;
  dataPagamento: string;
  onDataPagamentoChange: (d: string) => void;
  bandeira: Bandeira;
  onBandeiraChange: (b: Bandeira) => void;
  parcelasMaquina: number;
  onParcelasMaquinaChange: (n: number) => void;
  erroBaixaRetro: string | null;
  motivoRetro: string;
  onMotivoRetroChange: (v: string) => void;
};

export function VendaRetroativaSection({
  aberto,
  onToggle,
  valorCatalogoRef,
  valorManual,
  onValorManualChange,
  dataVenda,
  onDataVendaChange,
  jaPago,
  onJaPagoChange,
  avisoRecorrencia,
  formaRecebimento,
  onFormaRecebimentoChange,
  dataPagamento,
  onDataPagamentoChange,
  bandeira,
  onBandeiraChange,
  parcelasMaquina,
  onParcelasMaquinaChange,
  erroBaixaRetro,
  motivoRetro,
  onMotivoRetroChange,
}: Props) {
  const formasRetro = useMemo(
    () => FORMAS_RECEBIMENTO.filter((f) => f.value !== "cartao_credito_online"),
    [],
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-left"
        onClick={onToggle}
      >
        <span>Venda retroativa / ajuste de valor</span>
        <span className="text-xs text-muted-foreground">{aberto ? "Ocultar" : "Abrir"}</span>
      </button>
      {aberto && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="venda-valor-cobrado">Valor cobrado (R$)</Label>
              <Input
                id="venda-valor-cobrado"
                type="number"
                min={valorCatalogoRef}
                step="0.01"
                placeholder={valorCatalogoRef.toFixed(2)}
                value={valorManual}
                onChange={(e) => onValorManualChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Apenas valores acima do catálogo ({formatBRL(valorCatalogoRef)}).
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="venda-data-retro">Data da venda</Label>
              <Input
                id="venda-data-retro"
                type="date"
                value={dataVenda}
                onChange={(e) => onDataVendaChange(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={jaPago} onCheckedChange={(v) => onJaPagoChange(!!v)} />
            Já pago
          </label>

          {jaPago && (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
              {avisoRecorrencia && (
                <p className="text-xs text-muted-foreground">
                  Em recorrência mensal, apenas a 1ª mensalidade nasce paga; as próximas seguem a cobrança recorrente.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Forma de recebimento</Label>
                  <Select value={formaRecebimento} onValueChange={onFormaRecebimentoChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {formasRetro.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="venda-data-pagamento">Data do pagamento</Label>
                  <Input
                    id="venda-data-pagamento"
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => onDataPagamentoChange(e.target.value)}
                  />
                </div>
              </div>
              {(formaExigeBandeira(formaRecebimento) || formaPermiteParcelas(formaRecebimento)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formaExigeBandeira(formaRecebimento) && (
                    <div className="space-y-1">
                      <Label>Bandeira</Label>
                      <Select value={bandeira} onValueChange={(v) => onBandeiraChange(v as Bandeira)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BANDEIRAS_PADRAO.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formaPermiteParcelas(formaRecebimento) && (
                    <div className="space-y-1">
                      <Label>Parcelas na máquina</Label>
                      <Select value={String(parcelasMaquina)} onValueChange={(v) => onParcelasMaquinaChange(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              {erroBaixaRetro && <p className="text-xs text-destructive">{erroBaixaRetro}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="venda-motivo-retro">Motivo (obrigatório para ajuste/retroativa)</Label>
            <Input
              id="venda-motivo-retro"
              placeholder="Ex.: Venda fechada na recepção em data anterior"
              value={motivoRetro}
              onChange={(e) => onMotivoRetroChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}