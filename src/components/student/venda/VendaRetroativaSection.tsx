import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/vendas";

type Props = {
  aberto: boolean;
  onToggle: () => void;
  valorCatalogoRef: number;
  valorManual: string;
  onValorManualChange: (v: string) => void;
  dataVenda: string;
  onDataVendaChange: (d: string) => void;
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
  motivoRetro,
  onMotivoRetroChange,
}: Props) {
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