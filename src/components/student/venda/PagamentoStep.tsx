import { ReactNode } from "react";
import { CreditCard, Banknote, QrCode, FileText, Smartphone, Globe, Clock, Repeat } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TipoCobranca } from "@/lib/vendas-calc";
import { formatBRL } from "@/lib/vendas";

export type Modalidade =
  | "cartao_credito"
  | "pix_automatico"
  | "boleto"
  | "debito"
  | "dinheiro"
  | "pix_avista"
  | "pendente";

export type Canal = "maquininha" | "online" | "manual";

function Option({
  selected, onClick, icon, title, subtitle, right,
}: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
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
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{title}</span>
          {right}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </button>
  );
}

type Props = {
  tipoCobranca: TipoCobranca;
  total: number;
  mensalEstimado?: number;
  periodoMeses?: number;
  modalidade: Modalidade | null;
  onModalidadeChange: (m: Modalidade) => void;
  canalCartao: Canal | null;
  onCanalCartaoChange: (c: Canal) => void;
  parcelas: number;
  onParcelasChange: (n: number) => void;
};

const MODALIDADES_RECORRENCIA: { value: Modalidade; title: string; subtitle: string; icon: ReactNode }[] = [
  { value: "cartao_credito", title: "Cartão de Crédito (recorrente)", subtitle: "Tokenização via REDE e cobrança mensal automática.", icon: <CreditCard className="w-5 h-5" /> },
  { value: "pix_automatico", title: "Pix Automático", subtitle: "Autorização única; cobrança mensal via Pix.", icon: <Repeat className="w-5 h-5" /> },
  { value: "boleto", title: "Boleto", subtitle: "Geração mensal de boleto bancário.", icon: <FileText className="w-5 h-5" /> },
  { value: "pendente", title: "Finalizar com pagamento pendente", subtitle: "Configurar a forma de cobrança depois.", icon: <Clock className="w-5 h-5" /> },
];

const MODALIDADES_TRADICIONAL: { value: Modalidade; title: string; subtitle: string; icon: ReactNode }[] = [
  { value: "cartao_credito", title: "Cartão de Crédito", subtitle: "1x à 12x, maquininha ou online (REDE).", icon: <CreditCard className="w-5 h-5" /> },
  { value: "debito", title: "Débito (maquininha)", subtitle: "Pagamento presencial via maquininha.", icon: <CreditCard className="w-5 h-5" /> },
  { value: "dinheiro", title: "Dinheiro", subtitle: "Pagamento presencial em espécie.", icon: <Banknote className="w-5 h-5" /> },
  { value: "pix_avista", title: "Pix à vista", subtitle: "Pagamento único via Pix.", icon: <QrCode className="w-5 h-5" /> },
  { value: "pendente", title: "Finalizar com pagamento pendente", subtitle: "Concluir a venda sem registrar pagamento agora.", icon: <Clock className="w-5 h-5" /> },
];

export function PagamentoStep({
  tipoCobranca, total, mensalEstimado, periodoMeses,
  modalidade, onModalidadeChange,
  canalCartao, onCanalCartaoChange, parcelas, onParcelasChange,
}: Props) {
  const lista = tipoCobranca === "recorrencia" ? MODALIDADES_RECORRENCIA : MODALIDADES_TRADICIONAL;
  const isCartaoTradicional = tipoCobranca === "tradicional" && modalidade === "cartao_credito";
  const isRecorrencia = tipoCobranca === "recorrencia";
  const periodo = Math.max(1, Number(periodoMeses) || 12);
  const mensal = Number(mensalEstimado) || total / periodo;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
        {isRecorrencia ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mensalidade (cobrança agora e mensal)</span>
              <span className="font-semibold text-primary">{formatBRL(mensal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total do contrato ({periodo}× {formatBRL(mensal)})</span>
              <span>{formatBRL(total)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total a cobrar</span>
            <span className="font-semibold text-primary">{formatBRL(total)}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lista.map((m) => (
          <Option
            key={m.value}
            selected={modalidade === m.value}
            onClick={() => onModalidadeChange(m.value)}
            icon={m.icon}
            title={m.title}
            subtitle={m.subtitle}
          />
        ))}
      </div>

      {isCartaoTradicional && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select value={String(parcelas)} onValueChange={(v) => onParcelasChange(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x {n > 1 ? `de ${formatBRL(total / n)}` : "à vista"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCanalCartaoChange("maquininha")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                    canalCartao === "maquininha" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                  )}
                >
                  <Smartphone className="w-4 h-4" /> Maquininha
                </button>
                <button
                  type="button"
                  onClick={() => onCanalCartaoChange("online")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                    canalCartao === "online" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                  )}
                >
                  <Globe className="w-4 h-4" /> Online (REDE)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
