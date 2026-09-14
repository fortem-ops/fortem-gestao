import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RotateCcw, ShoppingBag } from "lucide-react";
import { formatBRL } from "@/lib/vendas";
import { labelFormaPagamento } from "@/lib/formasRecebimento";
import { estornarPedido } from "@/lib/lojaEstorno";

type Item = {
  quantidade: number;
  preco_unitario_snapshot: number;
  produtos_variantes: {
    tamanho: string | null;
    cor: string | null;
    sku: string | null;
    produtos_catalogo: { nome: string } | null;
  } | null;
};

type Pedido = {
  id: string;
  status: string;
  valor_final: number;
  forma_pagamento: string | null;
  created_at: string;
  pedido_itens: Item[];
};

export function ComprasLoja({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient();
  const [estornar, setEstornar] = useState<Pedido | null>(null);
  const [estornando, setEstornando] = useState(false);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["compras-loja-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, status, valor_final, forma_pagamento, created_at, pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("aluno_id", alunoId)
        .in("status", ["pago", "estornado"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Pedido[];
    },
  });

  const confirmarEstorno = async () => {
    if (!estornar) return;
    setEstornando(true);
    try {
      await estornarPedido(estornar.id);
      toast.success("Pedido estornado", { description: "O valor será devolvido ao cliente." });
      qc.invalidateQueries({ queryKey: ["compras-loja-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
      qc.invalidateQueries({ queryKey: ["loja-encomendas"] });
      setEstornar(null);
    } catch (e: any) {
      toast.error("Não foi possível estornar", { description: e.message });
    } finally {
      setEstornando(false);
    }
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (pedidos.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-primary" />
        Compras na Loja
      </h3>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm">
                  {(p.pedido_itens || [])
                    .map((it) => {
                      const v = it.produtos_variantes;
                      const variante = [v?.tamanho, v?.cor].filter(Boolean).join(" / ");
                      return `${it.quantidade}x ${v?.produtos_catalogo?.nome ?? "Produto"}${variante ? ` (${variante})` : ""}`;
                    })
                    .join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right">{formatBRL(Number(p.valor_final ?? 0))}</TableCell>
                <TableCell className="text-sm">
                  {p.forma_pagamento ? labelFormaPagamento(p.forma_pagamento) : "—"}
                </TableCell>
                <TableCell>
                  {p.status === "estornado" ? (
                    <Badge variant="outline" className="status-urgent">Estornado</Badge>
                  ) : (
                    <Badge variant="outline">Produto</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === "pago" && (
                    <Button size="icon" variant="ghost" title="Estornar pedido" onClick={() => setEstornar(p)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!estornar} onOpenChange={(o) => !o && setEstornar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja estornar este pedido? O valor será devolvido ao cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarEstorno();
              }}
              disabled={estornando}
            >
              {estornando ? "Estornando..." : "Estornar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
