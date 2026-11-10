import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEstoqueDisponivelAdmin, estoqueDe } from "@/hooks/useEstoqueDisponivelAdmin";

export type ItemEntrega = {
  itemId: string;
  varianteId: string;
  produtoId: string;
  cliente: string;
  produto: string;
  cor: string;
  corRaw: string | null;
  tamanho: string;
  quantidade: number;
};

const ERROS: Record<string, string> = {
  estoque_insuficiente: "Sem estoque físico nesse tamanho",
  troca_invalida: "Troca permitida só de tamanho",
  troca_nao_permitida: "Troca permitida só para encomendas",
  item_ja_entregue: "Este item já foi entregue",
  pedido_nao_pago: "O pedido não está pago",
  sem_permissao: "Sem permissão para entregar",
};
export const traduzirErroEntrega = (msg: string) => {
  const k = Object.keys(ERROS).find((c) => msg?.includes(c));
  return k ? ERROS[k] : msg;
};

export function EntregarEncomendaDialog({
  item,
  onClose,
  onDone,
}: {
  item: ItemEntrega | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sel, setSel] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const { data: estoque } = useEstoqueDisponivelAdmin();

  useEffect(() => setSel(item?.varianteId ?? ""), [item]);

  const { data: variantes = [] } = useQuery({
    queryKey: ["loja-entrega-variantes", item?.produtoId],
    enabled: !!item,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos_variantes")
        .select("id, tamanho, cor, estoque_atual, ativo")
        .eq("produto_id", item!.produtoId)
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as { id: string; tamanho: string | null; cor: string | null; estoque_atual: number }[];
    },
  });

  const opcoes = useMemo(
    () =>
      variantes
        .filter((v) => (v.cor ?? "") === (item?.corRaw ?? ""))
        .map((v) => {
          const e = estoqueDe(estoque, v.id, v.estoque_atual);
          const proprio = v.id === item?.varianteId;
          // Tamanho do pedido: valida pelo físico. Outro tamanho: pelo disponível (não pega peça de outra encomenda).
          const limite = proprio ? e.fisico : e.disponivel;
          return { ...v, fisico: e.fisico, disponivel: e.disponivel, proprio, limite };
        }),
    [variantes, item, estoque],
  );
  const escolhida = opcoes.find((o) => o.id === sel);
  const troca = !!item && !!sel && sel !== item.varianteId;

  const confirmar = async () => {
    if (!item || !sel) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc("fn_loja_entregar_item", {
        p_item_id: item.itemId,
        p_variante_entregue_id: sel,
      });
      if (error) throw error;
      toast.success("Entrega registrada");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error("Não foi possível entregar", { description: traduzirErroEntrega(e.message) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entregar encomenda</DialogTitle>
          <DialogDescription>Confira o tamanho entregue. Troca só de tamanho, mesma cor.</DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Cliente:</span> {item.cliente}</div>
              <div><span className="text-muted-foreground">Produto:</span> {item.produto}</div>
              <div><span className="text-muted-foreground">Cor:</span> {item.cor}</div>
              <div><span className="text-muted-foreground">Tamanho do pedido:</span> {item.tamanho}</div>
              <div><span className="text-muted-foreground">Quantidade:</span> {item.quantidade}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tamanho entregue</Label>
              <Select value={sel} onValueChange={setSel}>
                <SelectTrigger><SelectValue placeholder="Escolha o tamanho" /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((o) => {
                    const sem = o.limite < item.quantidade;
                    return (
                      <SelectItem key={o.id} value={o.id} disabled={sem}>
                        {o.tamanho || "—"} — físico {o.fisico} · disp. {o.disponivel}
                        {sem ? (o.proprio ? " (sem estoque)" : " (sem disponível)") : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {troca && (
              <p className="rounded-md border border-border p-2 status-warning text-xs">
                Troca de tamanho: {item.tamanho} → {escolhida?.tamanho || "—"}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando || !escolhida || (!!item && escolhida.limite < item.quantidade)}>
            {salvando ? "Salvando..." : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
