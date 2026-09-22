import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";

export type ItemEdicao = {
  id: string;
  pedido_id: string;
  variante_id: string;
  quantidade: number;
  produto_nome: string;
  tamanho: string | null;
  cor: string | null;
};

const ERROS: Record<string, string> = {
  nao_autenticado: "Sessão expirada. Entre novamente.",
  sem_permissao: "Você não tem permissão para editar itens de pedido.",
  parametros_invalidos: "Dados inválidos.",
  item_nao_encontrado: "Item não encontrado.",
  variante_igual_atual: "Selecione uma opção diferente da atual.",
  pedido_nao_encontrado: "Pedido não encontrado.",
  pedido_nao_pago: "Só é possível editar itens de pedidos pagos.",
  produto_diferente: "Só é possível trocar entre opções do mesmo produto.",
  variante_inativa: "Essa opção está inativa.",
  sem_estoque_e_sem_encomenda: "Sem estoque e o produto não permite encomenda.",
  falha_atualizar_item: "Não foi possível atualizar o item.",
  erro_interno: "Erro interno. Tente novamente.",
};

export function EditarItemPedidoDialog({
  item,
  onOpenChange,
}: {
  item: ItemEdicao | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [novaVariante, setNovaVariante] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const { data: variantes = [], isLoading } = useQuery({
    queryKey: ["loja-variantes-item", item?.variante_id],
    enabled: !!item,
    queryFn: async () => {
      const { data: atual, error: e1 } = await (supabase as any)
        .from("produtos_variantes")
        .select("produto_id")
        .eq("id", item!.variante_id)
        .maybeSingle();
      if (e1) throw e1;
      const { data, error } = await (supabase as any)
        .from("produtos_variantes")
        .select("id, tamanho, cor, preco, estoque_atual, ativo")
        .eq("produto_id", atual?.produto_id)
        .eq("ativo", true)
        .order("cor")
        .order("tamanho");
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        tamanho: string | null;
        cor: string | null;
        preco: number | null;
        estoque_atual: number;
      }>;
    },
  });

  const confirmar = async () => {
    if (!item || !novaVariante) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("loja-editar-item-pedido", {
        body: { pedido_item_id: item.id, nova_variante_id: novaVariante },
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) {
        toast.error(ERROS[res?.error] ?? "Não foi possível editar o item.");
        return;
      }
      toast.success(
        res.preco_alterado
          ? `Item atualizado. Novo valor do pedido: ${formatBRL(Number(res.valor_final ?? 0))} — confira a diferença de preço.`
          : "Item atualizado com sucesso.",
      );
      qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
      onOpenChange(false);
      setNovaVariante("");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao editar o item.");
    } finally {
      setSalvando(false);
    }
  };

  const atualLabel = [item?.tamanho, item?.cor].filter(Boolean).join(" / ") || "Padrão";

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) setNovaVariante(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar item do pedido</DialogTitle>
          <DialogDescription>
            {item?.produto_nome} — atualmente <strong>{atualLabel}</strong>. Escolha a nova opção do mesmo produto.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="space-y-2">
            <Label>Nova opção (tamanho / cor)</Label>
            <Select value={novaVariante} onValueChange={setNovaVariante}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {variantes
                  .filter((v) => v.id !== item?.variante_id)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[v.tamanho, v.cor].filter(Boolean).join(" / ") || "Padrão"}
                      {` — estoque ${v.estoque_atual}`}
                      {v.preco != null ? ` — ${formatBRL(Number(v.preco))}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Diferenças de preço não são cobradas nem estornadas automaticamente — o ajuste financeiro é manual.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!novaVariante || salvando}>
            {salvando ? "Salvando..." : "Confirmar troca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
