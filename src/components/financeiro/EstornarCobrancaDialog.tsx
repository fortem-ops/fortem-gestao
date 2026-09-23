import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSaldoEstornavel, useEstornarCobranca, type ComprovanteEstorno } from "@/hooks/useEstorno";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: {
    id: string;
    numero_ciclo?: number | null;
    valor: number;
    data_pagamento?: string | null;
    tid?: string | null;
  };
  alunoNome: string;
  onEstornado: (c: ComprovanteEstorno) => void;
}

export function EstornarCobrancaDialog({ open, onOpenChange, cobranca, alunoNome, onEstornado }: Props) {
  const { data: saldo, isLoading } = useSaldoEstornavel(cobranca.id, open);
  const estornar = useEstornarCobranca();

  const [tipo, setTipo] = useState<"total" | "parcial">("total");
  const [valorParcial, setValorParcial] = useState("");
  const [motivo, setMotivo] = useState("");
  // Uma chave por abertura do diálogo: impede que duplo clique gere dois estornos.
  const idempotencyKey = useMemo(
    () => (open ? crypto.randomUUID() : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const disponivel = saldo?.saldo_estornavel ?? 0;
  const valorNumerico = tipo === "total" ? disponivel : Number(valorParcial.replace(",", "."));
  const valorValido =
    tipo === "total"
      ? disponivel > 0
      : Number.isFinite(valorNumerico) && valorNumerico > 0 && valorNumerico <= disponivel + 0.001;

  const podeConfirmar = !isLoading && valorValido && motivo.trim().length >= 10 && !estornar.isPending;

  const confirmar = async () => {
    if (!podeConfirmar) return;
    try {
      const comprovante = await estornar.mutateAsync({
        cobrancaId: cobranca.id,
        tipo,
        valor: tipo === "parcial" ? Number(valorNumerico.toFixed(2)) : undefined,
        motivo: motivo.trim(),
        idempotencyKey,
      });
      toast.success("Estorno confirmado pela operadora");
      onOpenChange(false);
      setMotivo("");
      setValorParcial("");
      setTipo("total");
      onEstornado(comprovante);
    } catch {
      /* mensagem já exibida pelo hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !estornar.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Estornar cobrança</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <span>Esta ação devolve dinheiro real ao aluno e não pode ser desfeita.</span>
        </div>

        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="rounded-lg border divide-y text-sm">
            <Linha rotulo="Aluno" valor={alunoNome} />
            <Linha rotulo="Ciclo" valor={cobranca.numero_ciclo ? String(cobranca.numero_ciclo) : "—"} />
            <Linha
              rotulo="Pago"
              valor={`${brl(saldo?.valor_pago ?? cobranca.valor)}${
                cobranca.data_pagamento
                  ? ` em ${new Date(cobranca.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}`
                  : ""
              }`}
            />
            <Linha rotulo="Já estornado" valor={brl(saldo?.total_estornado ?? 0)} />
            <Linha rotulo="Disponível para estorno" valor={brl(disponivel)} />
            <Linha rotulo="TID" valor={saldo?.tid ?? cobranca.tid ?? "—"} mono />
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo de estorno</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as "total" | "parcial")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="total" id="estorno-total" />
                <Label htmlFor="estorno-total" className="font-normal">Total ({brl(disponivel)})</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="parcial" id="estorno-parcial" />
                <Label htmlFor="estorno-parcial" className="font-normal">Parcial</Label>
              </div>
            </RadioGroup>
          </div>

          {tipo === "parcial" && (
            <div className="space-y-1.5">
              <Label htmlFor="valor-parcial">Valor a estornar</Label>
              <Input
                id="valor-parcial"
                inputMode="decimal"
                value={valorParcial}
                onChange={(e) => setValorParcial(e.target.value)}
                placeholder="0,00"
              />
              {valorParcial && !valorValido && (
                <p className="text-xs text-destructive">
                  Informe um valor maior que zero e no máximo {brl(disponivel)}.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="motivo-estorno">Motivo do estorno (obrigatório)</Label>
            <Textarea
              id="motivo-estorno"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo (mínimo 10 caracteres)"
            />
            <p className="text-xs text-muted-foreground">{motivo.trim().length}/10 caracteres</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={estornar.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={!podeConfirmar}>
            {estornar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <span className="w-48 shrink-0 text-muted-foreground">{rotulo}</span>
      <span className={`font-medium break-all ${mono ? "font-mono text-xs" : ""}`}>{valor}</span>
    </div>
  );
}
