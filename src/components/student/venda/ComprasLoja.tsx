import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag } from "lucide-react";
import { formatBRL } from "@/lib/vendas";
import { labelFormaPagamento } from "@/lib/formasRecebimento";

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
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["compras-loja-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, status, valor_final, forma_pagamento, created_at, pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("aluno_id", alunoId)
        .eq("status", "pago")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Pedido[];
    },
  });

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
                  <Badge variant="outline">Produto</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
