import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  onDone: () => void;
}

export function AtivarPixDialog({ open, onOpenChange, alunoId, onDone }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState(today);
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const v = Number(valor.replace(",", "."));
    if (!isFinite(v) || v <= 0) {
      toast.error("Informe um valor mínimo válido");
      return;
    }
    setLoading(true);
    try {
      const { data: rec, error: e1 } = await supabase.functions.invoke("pix-criar-recorrencia", {
        body: { aluno_id: alunoId, valor_minimo: v, data_inicio: dataInicio, data_fim: dataFim || null },
      });
      if (e1 || rec?.error) throw new Error(rec?.error || e1?.message);
      const idRec = rec?.recorrencia?.id_rec;
      if (!idRec) throw new Error("idRec não retornado");

      const { data: solic, error: e2 } = await supabase.functions.invoke("pix-solicitar-confirmacao", {
        body: { idRec },
      });
      if (e2 || solic?.error) throw new Error(solic?.error || e2?.message);

      toast.success("Pix Automático criado! Aguardando autorização do aluno no app do banco.");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao ativar Pix Automático");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ativar Pix Automático</DialogTitle>
          <DialogDescription>
            Defina o valor mínimo da recorrência mensal e o período de vigência.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="valor">Valor mínimo (R$)</Label>
            <Input id="valor" inputMode="decimal" placeholder="Ex: 150,00"
              value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ini">Data de início</Label>
              <Input id="ini" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fim">Data final (opcional)</Label>
              <Input id="fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Após confirmar, o aluno receberá uma notificação no app do banco para autorizar.
            As cobranças serão debitadas automaticamente todo mês.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enviando..." : "Ativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
