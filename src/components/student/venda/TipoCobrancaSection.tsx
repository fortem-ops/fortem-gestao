import { ReactNode } from "react";
import { Repeat, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TAXA_MENSAL_RECORRENCIA,
  TipoCobranca,
  calcularTotaisVenda,
} from "@/lib/vendas-calc";
import { formatBRL } from "@/lib/vendas";

function Option({
  selected, onClick, icon, title, subtitle,
}: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-all",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
      )}
    >
      <div className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}

type Props = {
  valorPlano: number;
  periodoMeses: number;
  desconto: number;
  onDescontoChange: (n: number) => void;
  tipoCobranca: TipoCobranca | null;
  onTipoCobrancaChange: (t: TipoCobranca) => void;
  aluno2025: boolean;
  onAluno2025Change: (v: boolean) => void;
  canTogglesAluno2025: boolean;
};

export function TipoCobrancaSection({
  valorPlano, periodoMeses, desconto, onDescontoChange,
  tipoCobranca, onTipoCobrancaChange, aluno2025, onAluno2025Change, canTogglesAluno2025,
}: Props) {
  const t = calcularTotaisVenda({ valorPlano, desconto, periodoMeses, tipoCobranca, aluno2025 });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de cobrança</Label>
        <div className="space-y-2">
          <Option
            selected={tipoCobranca === "recorrencia"}
            onClick={() => onTipoCobrancaChange("recorrencia")}
            icon={<Repeat className="w-5 h-5" />}
            title="Recorrência"
            subtitle={`Cobrança mensal automática. Acréscimo de ${formatBRL(TAXA_MENSAL_RECORRENCIA)}/mês de taxa de serviço (isento para Aluno 2025).`}
          />
          <Option
            selected={tipoCobranca === "tradicional"}
            onClick={() => onTipoCobrancaChange("tradicional")}
            icon={<Wallet className="w-5 h-5" />}
            title="Tradicional"
            subtitle="Pagamento único ou parcelado, sem taxa mensal."
          />
        </div>
      </div>

      {tipoCobranca === "recorrencia" && canTogglesAluno2025 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Checkbox
            id="aluno-2025"
            checked={aluno2025}
            onCheckedChange={(v) => onAluno2025Change(!!v)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label htmlFor="aluno-2025" className="cursor-pointer font-medium">
              Aluno de 2025 (isento da taxa de {formatBRL(TAXA_MENSAL_RECORRENCIA)}/mês)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Marcado, esta condição fica registrada no cadastro do aluno.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Desconto sobre o plano (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          max={valorPlano}
          value={desconto || ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || 0;
            onDescontoChange(Math.min(Math.max(0, v), valorPlano));
          }}
          placeholder="0,00"
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Valor do plano</span>
          <span>{formatBRL(t.valorPlano)}</span>
        </div>
        {t.desconto > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Desconto</span>
            <span>− {formatBRL(t.desconto)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal do plano</span>
          <span>{formatBRL(t.subtotalPlano)}</span>
        </div>
        {tipoCobranca === "recorrencia" && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              Taxa mensal ({formatBRL(t.taxaMensal)} × {periodoMeses})
            </span>
            <span>{formatBRL(t.taxaTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
          <span>Total a cobrar</span>
          <span className="text-primary">{formatBRL(t.total)}</span>
        </div>
        {tipoCobranca === "recorrencia" && (
          <div className="text-xs text-muted-foreground text-right">
            Mensal estimado: {formatBRL(t.mensalEstimado)}
          </div>
        )}
      </div>
    </div>
  );
}
