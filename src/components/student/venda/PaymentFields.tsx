import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";

export type FormaPagamento = {
  id: string;
  nome: string;
  slug: string;
  permite_parcelamento: boolean;
  ativo: boolean;
  ordem: number;
};

export function useFormasPagamento() {
  return useQuery({
    queryKey: ["formas-pagamento-ativas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      return (data || []) as FormaPagamento[];
    },
  });
}

const ADD_NEW_VALUE = "__add_new__";

type Props = {
  valorBase: number;
  desconto: number;
  onDescontoChange: (v: number) => void;
  formaPagamentoSlug: string | null;
  onFormaPagamentoChange: (slug: string | null) => void;
  parcelas: number;
  onParcelasChange: (n: number) => void;
  showSummary?: boolean;
  isCoordAdmin?: boolean;
};

export function PaymentFields({
  valorBase,
  desconto,
  onDescontoChange,
  formaPagamentoSlug,
  onFormaPagamentoChange,
  parcelas,
  onParcelasChange,
  showSummary = true,
  isCoordAdmin = true,
}: Props) {
  const qc = useQueryClient();
  const { data: formas = [] } = useFormasPagamento();
  const [addOpen, setAddOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoPermiteParc, setNovoPermiteParc] = useState(false);
  const [saving, setSaving] = useState(false);

  const formaSelecionada = formas.find((f) => f.slug === formaPagamentoSlug) || null;
  const permiteParc = formaSelecionada?.permite_parcelamento ?? false;
  const total = Math.max(0, valorBase - (desconto || 0));

  function slugify(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function criarForma() {
    if (!novoNome.trim()) {
      toast.error("Informe o nome da forma de pagamento");
      return;
    }
    setSaving(true);
    try {
      const slug = slugify(novoNome);
      const ordem = (formas[formas.length - 1]?.ordem || 0) + 1;
      const { data, error } = await (supabase as any)
        .from("formas_pagamento")
        .insert({ nome: novoNome.trim(), slug, permite_parcelamento: novoPermiteParc, ordem })
        .select()
        .single();
      if (error) throw error;
      toast.success("Forma de pagamento criada");
      qc.invalidateQueries({ queryKey: ["formas-pagamento-ativas"] });
      onFormaPagamentoChange(data.slug);
      setAddOpen(false);
      setNovoNome("");
      setNovoPermiteParc(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar forma de pagamento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <Select
            value={formaPagamentoSlug ?? ""}
            onValueChange={(v) => {
              if (v === ADD_NEW_VALUE) {
                setAddOpen(true);
                return;
              }
              onFormaPagamentoChange(v || null);
              const f = formas.find((x) => x.slug === v);
              if (!f?.permite_parcelamento) onParcelasChange(1);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {formas.map((f) => (
                <SelectItem key={f.id} value={f.slug}>{f.nome}</SelectItem>
              ))}
              {isCoordAdmin && (
                <SelectItem value={ADD_NEW_VALUE} className="text-primary">
                  + Adicionar forma de pagamento
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {permiteParc ? (
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
        ) : (
          <div className="space-y-2">
            <Label>Desconto (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={valorBase}
              value={desconto || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                onDescontoChange(Math.min(Math.max(0, v), valorBase));
              }}
              placeholder="0,00"
            />
          </div>
        )}
      </div>

      {permiteParc && (
        <div className="space-y-2">
          <Label>Desconto (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={valorBase}
            value={desconto || ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              onDescontoChange(Math.min(Math.max(0, v), valorBase));
            }}
            placeholder="0,00"
          />
        </div>
      )}

      {showSummary && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatBRL(valorBase)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Desconto</span>
              <span>− {formatBRL(desconto)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{formatBRL(total)}</span>
          </div>
          {permiteParc && parcelas > 1 && (
            <div className="text-xs text-muted-foreground text-right">
              em {parcelas}x de {formatBRL(total / parcelas)}
            </div>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nova forma de pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Transferência bancária"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="permite-parc"
                checked={novoPermiteParc}
                onCheckedChange={(v) => setNovoPermiteParc(!!v)}
              />
              <Label htmlFor="permite-parc" className="cursor-pointer">Permite parcelamento (até 12x)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={criarForma}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
