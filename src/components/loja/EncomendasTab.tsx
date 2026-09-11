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

type PedidoRow = {
  id: string;
  nome: string | null;
  created_at: string;
  pedido_itens: ItemRow[];
};

type Linha = {
  key: string;
  cliente: string;
  produto: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  valorTotal: number;
  data: string;
};

export function EncomendasTab() {
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["loja-encomendas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, nome, created_at, pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(id, tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("eh_encomenda", true)
        .eq("status", "pago")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PedidoRow[];
    },
  });

  const grupos = useMemo(() => {
    const linhas: Linha[] = [];
    for (const p of pedidos) {
      (p.pedido_itens || []).forEach((it, idx) => {
        const v = it.produtos_variantes;
        if (!v) return;
        linhas.push({
          key: `${p.id}-${v.id}-${idx}`,
          cliente: p.nome || "Cliente não informado",
          produto: v.produtos_catalogo?.nome || "Produto removido",
          cor: v.cor || "—",
          tamanho: v.tamanho || "—",
          quantidade: it.quantidade,
          valorTotal: Number(it.preco_unitario_snapshot) * it.quantidade,
          data: p.created_at,
        });
      });
    }
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
            <TableHead>Cliente</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Cor</TableHead>
            <TableHead>Tamanho</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead className="text-right">Valor pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map(([produto, linhas]) => {
            const subQtd = linhas.reduce((s, l) => s + l.quantidade, 0);
            const subVal = linhas.reduce((s, l) => s + l.valorTotal, 0);
            return (
              <Fragment key={produto}>
                {linhas.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-medium">{l.cliente}</TableCell>
                    <TableCell>{l.produto}</TableCell>
                    <TableCell>{l.cor}</TableCell>
                    <TableCell>{l.tamanho}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">{l.quantidade}</TableCell>
                    <TableCell className="text-right">{formatBRL(l.valorTotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow key={`${produto}-subtotal`} className="bg-secondary/40">
                  <TableCell colSpan={5} className="text-xs font-semibold text-muted-foreground">
                    Subtotal — {produto}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">{subQtd}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">{formatBRL(subVal)}</TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
