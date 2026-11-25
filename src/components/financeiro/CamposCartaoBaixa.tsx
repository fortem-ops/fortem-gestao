import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BANDEIRAS_PADRAO } from "@/types/adquirente";
import { useAdquirente } from "@/hooks/useAdquirente";
import { formaExigeBandeira, formaPermiteParcelas } from "@/lib/formasRecebimento";

interface CamposCartaoBaixaProps {
  forma: string;
  bandeira: string;
  onBandeiraChange: (value: string) => void;
  parcelas: number;
  onParcelasChange: (value: number) => void;
  idPrefix?: string;
}

const PARCELAS_OPCOES = Array.from({ length: 12 }, (_, i) => i + 1);

export function CamposCartaoBaixa({
  forma,
  bandeira,
  onBandeiraChange,
  parcelas,
  onParcelasChange,
  idPrefix = "baixa",
}: CamposCartaoBaixaProps) {
  const exigeBandeira = formaExigeBandeira(forma);
  const permiteParcelas = formaPermiteParcelas(forma);
  const { configQ } = useAdquirente("rede");
  const bandeiraPadrao = configQ.data?.bandeira_padrao || "mastercard";

  useEffect(() => {
    if (exigeBandeira && !bandeira) {
      onBandeiraChange(bandeiraPadrao);
    }
  }, [exigeBandeira, bandeira, bandeiraPadrao, onBandeiraChange]);

  if (!exigeBandeira) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-bandeira`}>Bandeira</Label>
        <Select value={bandeira} onValueChange={onBandeiraChange}>
          <SelectTrigger id={`${idPrefix}-bandeira`}>
            <SelectValue placeholder="Selecione a bandeira" />
          </SelectTrigger>
          <SelectContent>
            {BANDEIRAS_PADRAO.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {permiteParcelas && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-parcelas`}>Parcelas</Label>
          <Select
            value={String(parcelas)}
            onValueChange={(v) => onParcelasChange(Number(v))}
          >
            <SelectTrigger id={`${idPrefix}-parcelas`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARCELAS_OPCOES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 ? "1x (à vista)" : `${n}x`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}