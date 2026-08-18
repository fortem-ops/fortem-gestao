import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contratoId: string;
  cobrancas: any[];
}

interface LinhaEdicao {
  id: string;
  status: string;
  data_vencimento: string;
  valor: string;
  origData: string;
  origValor: string;
}

const statusBadgeClass = (status: string) =>
  status === "pago"
    ? "bg-green-600 hover:bg-green-600"
    : status === "atrasado"
      ? "bg-red-600 hover:bg-red-600"
      : status === "cancelado"
        ? "bg-gray-500 hover:bg-gray-500"
        : "bg-yellow-500 hover:bg-yellow-500 text-black";

const statusLabel = (status: string) =>
  status === "pago"
    ? "Pago"
    : status === "pendente"
      ? "Pendente"
      : status === "atrasado"
        ? "Atrasado"
        : status === "cancelado"
          ? "Cancelado"
          : status;

const editavel = (status: string) => status === "pendente" || status === "atrasado";

export function AlterarDadosVendaDialog({ open, onOpenChange, contratoId, cobrancas }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLinhas(
      cobrancas.map((c) => ({
        id: c.id,
        status: c.status,
        data_vencimento: c.data_vencimento ?? "",
        valor: c.valor != null ? Number(c.valor).toFixed(2) : "",
        origData: c.data_vencimento ?? "",
        origValor: c.valor != null ? Number(c.valor).toFixed(2) : "",
      })),
    );
  }, [open, cobrancas]);

  const erroLinha = (l: LinhaEdicao): string | null => {
    if (!editavel(l.status)) return null;
    if (!l.data_vencimento) return "Informe o vencimento.";
    if (l.valor.trim() === "") return "Informe o valor.";
    const n = Number(l.valor);
    if (Number.isNaN(n)) return "Valor inválido.";
    if (n < 0) return "Valor não pode ser negativo.";
    return null;
  };

  const temErro = linhas.some((l) => erroLinha(l) !== null);

  const update = (id: string, patch: Partial<LinhaEdicao>) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const handleSalvar = async () => {
    if (temErro) return;
    const alteradas = linhas.filter(
      (l) =>
        editavel(l.status) &&
        (l.data_vencimento !== l.origData || Number(l.valor) !== Number(l.origValor)),
    );
    if (!alteradas.length) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      for (const l of alteradas) {
        const { error } = await supabase
          .from("cobrancas")
          .update({ data_vencimento: l.data_vencimento, valor: Number(l.valor) })
          .eq("id", l.id);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["cobrancas-contrato", contratoId] });
      toast({ title: "Dados da venda atualizados" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alterar dados da venda</DialogTitle>
          <DialogDescription>
            Edite vencimento e valor das cobranças em aberto deste contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-center">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, idx) => {
                const erro = erroLinha(l);
                const bloqueado = !editavel(l.status);
                return (
                  <TableRow key={l.id} className={bloqueado ? "opacity-60" : ""}>
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        className="h-8"
                        value={l.data_vencimento}
                        disabled={bloqueado}
                        onChange={(e) => update(l.id, { data_vencimento: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8"
                        value={l.valor}
                        disabled={bloqueado}
                        onChange={(e) => update(l.id, { valor: e.target.value })}
                      />
                      {erro && <p className="text-xs text-destructive mt-1">{erro}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(l.status)}>{statusLabel(l.status)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving || temErro} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
