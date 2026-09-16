import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";
import { FORMAS_RECEBIMENTO, getFormaRecebimento } from "@/lib/formasRecebimento";

const db = supabase as any;

export type PedidoBaixa = {
  id: string;
  nome: string | null;
  valor_final: number;
  resumo: string;
};

export function DarBaixaPedidoDialog({
  pedido,
  onOpenChange,
}: {
  pedido: PedidoBaixa | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [forma, setForma] = useState<string>("dinheiro");
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!pedido) return;
    const selecionada = getFormaRecebimento(forma);
    if (!selecionada) return;
    setSalvando(true);
    try {
      const { error } = await db
        .from("pedidos")
        .update({ status: "pago", forma_pagamento: selecionada.vendaForma })
        .eq("id", pedido.id)
        .eq("status", "aguardando_pagamento");
      if (error) throw error;

      try {
        await db.rpc("fn_loja_vincular_aluno", { p_pedido_id: pedido.id });
      } catch {
        /* vínculo é opcional */
      }
      try {
        await supabase.functions.invoke("loja-enviar-confirmacao-email", {
          body: { pedido_id: pedido.id },
        });
      } catch {
        /* e-mail não bloqueia a baixa */
      }

      toast.success("Pagamento registrado", {
        description: `${pedido.nome || "Cliente"} — ${selecionada.label}.`,
      });
      qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
      qc.invalidateQueries({ queryKey: ["loja-encomendas"] });
      qc.invalidateQueries({ queryKey: ["compras-loja-aluno"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Não foi possível dar baixa", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa no pedido</DialogTitle>
          <DialogDescription>
            {pedido && (
              <>
                Pedido de <strong>{pedido.nome || "cliente não informado"}</strong> — {pedido.resumo}, valor{" "}
                {formatBRL(Number(pedido.valor_final ?? 0))}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Forma de recebimento</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {FORMAS_RECEBIMENTO.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando ? "Registrando..." : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
