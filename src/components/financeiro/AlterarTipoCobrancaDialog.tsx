import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/vendas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato: any;
  cobrancas: any[];
}

const FORMAS_REC = [
  { v: "cartao_recorrencia", l: "Cartão recorrente" },
  { v: "pix_automatico", l: "Pix automático" },
  { v: "boleto", l: "Boleto" },
  { v: "pendente", l: "Pendente (definir depois)" },
];
const FORMAS_TRAD = [
  { v: "cartao_parcelado", l: "Cartão parcelado" },
  { v: "maquina_credito", l: "Maquininha crédito" },
  { v: "maquina_debito", l: "Maquininha débito" },
  { v: "dinheiro", l: "Dinheiro" },
  { v: "boleto", l: "Boleto" },
  { v: "pendente", l: "Pendente (definir depois)" },
];

export function AlterarTipoCobrancaDialog({ open, onOpenChange, contrato, cobrancas }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const recorrenteAtual = contrato.forma_pagamento === "cartao_recorrencia" || contrato.forma_pagamento === "pix_automatico";
  const [tipo, setTipo] = useState<"recorrencia" | "tradicional">("recorrencia");
  const [forma, setForma] = useState("cartao_recorrencia");
  const [parcelas, setParcelas] = useState(1);
  const [primeiro, setPrimeiro] = useState("");
  const [taxa, setTaxa] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = recorrenteAtual ? "tradicional" : "recorrencia";
    setTipo(t);
    setForma(t === "recorrencia" ? "cartao_recorrencia" : "cartao_parcelado");
    setParcelas(1);
    setTaxa(false);
    setPrimeiro(contrato.data_inicio ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const bloqueado = cobrancas.some((c) => ["pago", "estornado", "isento"].includes(c.status) || c.tid);
  const total = Number(contrato.valor_base ?? contrato.valor_cobrado ?? 0);
  const n = tipo === "recorrencia"
    ? contrato.vigencia_tipo === "anual" ? 12 : contrato.vigencia_tipo === "semestral" ? 6 : 1
    : parcelas;
  const valorParcela = total / n + (tipo === "recorrencia" && taxa ? 20 : 0);
  const emAberto = cobrancas.filter((c) => ["pendente", "atrasado", "cancelado"].includes(c.status)).length;

  const salvar = async () => {
    setSaving(true);
    try {
      const dia = primeiro ? Number(primeiro.slice(8, 10)) : null;
      const { error } = await (supabase as any).rpc("fn_alterar_tipo_cobranca_contrato", {
        p_contrato_id: contrato.id, p_tipo: tipo, p_forma: forma, p_parcelas: n,
        p_dia_venc: dia, p_aplicar_taxa: tipo === "recorrencia" && taxa, p_primeiro_venc: primeiro || null,
      });
      if (error) throw error;
      ["cobrancas-contrato", "contratos", "contrato-ativo", "vendas", "inadimplentes", "planos"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      qc.invalidateQueries({ queryKey: ["cobrancas-contrato", contrato.id] });
      toast({ title: "Tipo de cobrança alterado" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao alterar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formas = tipo === "recorrencia" ? FORMAS_REC : FORMAS_TRAD;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alterar tipo de cobrança</DialogTitle>
          <DialogDescription>Substitui as cobranças em aberto deste contrato. Nada é cobrado no cartão.</DialogDescription>
        </DialogHeader>
        {bloqueado ? (
          <p className="text-sm text-destructive">Este contrato já tem cobrança paga ou estornada; o tipo de cobrança não pode ser alterado.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["recorrencia", "tradicional"] as const).map((t) => (
                <Button key={t} type="button" variant={tipo === t ? "default" : "outline"}
                  onClick={() => { setTipo(t); setForma(t === "recorrencia" ? "cartao_recorrencia" : "cartao_parcelado"); }}>
                  {t === "recorrencia" ? "Recorrente (mensal)" : "Tradicional"}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Forma</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{formas.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Primeiro vencimento</Label>
                <Input type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} />
              </div>
            </div>
            {tipo === "tradicional" ? (
              <div className="space-y-1">
                <Label>Parcelas</Label>
                <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
                      <SelectItem key={i} value={String(i)}>{i}x de {formatBRL(total / i)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={taxa} onCheckedChange={(v) => setTaxa(!!v)} />
                Aplicar taxa de recorrência (R$ 20/mês)
              </label>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div>Saem: <b>{emAberto}</b> cobrança(s) em aberto</div>
              <div>Entram: <b>{n}×</b> {formatBRL(valorParcela)} {tipo === "recorrencia" ? "(mensal)" : ""}</div>
              <div className="text-muted-foreground">Total: {formatBRL(valorParcela * n)}</div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || bloqueado || !primeiro}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
