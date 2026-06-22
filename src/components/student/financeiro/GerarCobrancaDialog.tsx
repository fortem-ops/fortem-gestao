import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  idRec: string;
  onDone: () => void;
}

export function GerarCobrancaDialog({ open, onOpenChange, idRec, onDone }: Props) {
  const venc = new Date(); venc.setDate(venc.getDate() + 7);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(venc.toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("Mensalidade Fortem");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const v = Number(valor.replace(",", "."));
    if (!isFinite(v) || v <= 0) { toast.error("Valor inválido"); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("pix-criar-cobranca", {
        body: { idRec, valor: v, dataVencimento: data, descricao },
      });
      if (error || res?.error) throw new Error(res?.error || error?.message);
      toast.success("Cobrança gerada");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao gerar cobrança");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar cobrança do mês</DialogTitle>
          <DialogDescription>Informe valor e vencimento da próxima cobrança Pix.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 150,00" />
          </div>
          <div>
            <Label>Data de vencimento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Enviando..." : "Gerar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
