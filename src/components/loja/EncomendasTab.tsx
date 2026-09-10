import { useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageOpen } from "lucide-react";
import { formatBRL } from "@/lib/vendas";

type ItemRow = {
  quantidade: number;
  preco_unitario_snapshot: number;
  produtos_variantes: {
    id: string;
    tamanho: string | null;
    cor: string | null;
    sku: string | null;
    produtos_catalogo: { nome: string } | null;
  } | null;
};

type PedidoRow = { id: string; pedido_itens: ItemRow[] };

type Linha = {
  varianteId: string;
  produto: string;
  variante: string;
  quantidade: number;
  valorTotal: number;
};

export function EncomendasTab() {
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["loja-encomendas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(id, tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("eh_encomenda", true)
        .eq("status", "pago");
      if (error) throw error;
      return (data || []) as PedidoRow[];
    },
  });

  const grupos = useMemo(() => {
    const porVariante = new Map<string, Linha>();
    for (const p of pedidos) {
      for (const it of p.pedido_itens || []) {
        const v = it.produtos_variantes;
        if (!v) continue;
        const produto = v.produtos_catalogo?.nome || "Produto removido";
        const variante = [v.tamanho, v.cor].filter(Boolean).join(" / ") || v.sku || "Padrão";
        const cur = porVariante.get(v.id) || {
          varianteId: v.id,
          produto,
          variante,
          quantidade: 0,
          valorTotal: 0,
        };
        cur.quantidade += it.quantidade;
        cur.valorTotal += Number(it.preco_unitario_snapshot) * it.quantidade;
        porVariante.set(v.id, cur);
      }
    }
    const linhas = Array.from(porVariante.values()).sort((a, b) => b.quantidade - a.quantidade);
    const map = new Map<string, Linha[]>();
    for (const l of linhas) {
      const arr = map.get(l.produto) || [];
      arr.push(l);
      map.set(l.produto, arr);
    }
    return Array.from(map.entries());
  }, [pedidos]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (grupos.length === 0) {
    return (
      <div className="rounded-lg border border-border py-12 flex flex-col items-center gap-2 text-muted-foreground">
        <PackageOpen className="w-8 h-8" />
        <p className="text-sm">Nenhuma encomenda registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Variante</TableHead>
            <TableHead className="text-right">Qtd. encomendada</TableHead>
            <TableHead className="text-right">Valor total pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map(([produto, linhas]) => {
            const subQtd = linhas.reduce((s, l) => s + l.quantidade, 0);
            const subVal = linhas.reduce((s, l) => s + l.valorTotal, 0);
            return (
              <Fragment key={produto}>
                {linhas.map((l) => (
                  <TableRow key={l.varianteId}>
                    <TableCell className="font-medium">{l.produto}</TableCell>
                    <TableCell>{l.variante}</TableCell>
                    <TableCell className="text-right">{l.quantidade}</TableCell>
                    <TableCell className="text-right">{formatBRL(l.valorTotal)}</TableCell>
                  </TableRow>
                ))}
                {linhas.length > 1 && (
                  <TableRow key={`${produto}-subtotal`} className="bg-secondary/40">
                    <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground">
                      Subtotal — {produto}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">{subQtd}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatBRL(subVal)}</TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
