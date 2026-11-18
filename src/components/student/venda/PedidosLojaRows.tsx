import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/vendas";
import { labelFormaPagamento } from "@/lib/formasRecebimento";
import { podeDarBaixaPedido, statusPedidoLabel } from "@/lib/lojaBalcao";
import { DarBaixaPedidoDialog, type PedidoBaixa } from "@/components/loja/DarBaixaPedidoDialog";

type Linha = {
  id: string; status: string; valor_final: number; forma_pagamento: string | null; created_at: string;
  pedido_itens: { quantidade: number; produtos_variantes: { tamanho: string | null; cor: string | null; produtos_catalogo: { nome: string } | null } | null }[];
};

const cor: Record<string, string> = {
  pago: "status-active", aguardando_pagamento: "status-warning", cancelado: "status-urgent",
  expirado: "status-urgent", estornado: "bg-destructive/15 text-destructive border-destructive/30",
};

export function usePedidosLojaAluno(alunoId: string) {
  return useQuery({
    queryKey: ["compras-loja-aluno", alunoId, "historico"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos")
        .select("id, status, valor_final, forma_pagamento, created_at, pedido_itens(quantidade, produtos_variantes!pedido_itens_variante_id_fkey(tamanho, cor, produtos_catalogo(nome)))")
        .eq("aluno_id", alunoId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });
}

function resumo(p: Linha) {
  return p.pedido_itens.map((i) => {
    const v = i.produtos_variantes;
    const det = [v?.tamanho, v?.cor].filter(Boolean).join(" · ");
    return `${i.quantidade}× ${v?.produtos_catalogo?.nome ?? "Produto"}${det ? ` (${det})` : ""}`;
  }).join(", ");
}

export function PedidosLojaRows({ pedidos, colunasExtras }: { pedidos: Linha[]; colunasExtras: boolean }) {
  const [baixa, setBaixa] = useState<PedidoBaixa | null>(null);
  return (
    <>
      {pedidos.map((p) => (
        <TableRow key={`pedido-${p.id}`}>
          <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
          <TableCell><Badge variant="outline">Produto</Badge></TableCell>
          <TableCell className="font-medium">{resumo(p)}</TableCell>
          <TableCell>{formatBRL(Number(p.valor_final ?? 0))}</TableCell>
          <TableCell>{p.forma_pagamento ? labelFormaPagamento(p.forma_pagamento) : "A definir"}</TableCell>
          <TableCell>—</TableCell>
          <TableCell><Badge variant="outline" className={cor[p.status] ?? ""}>{statusPedidoLabel(p.status)}</Badge></TableCell>
          <TableCell>—</TableCell>
          {colunasExtras && (
            <TableCell>
              {podeDarBaixaPedido(p.status) && (
                <Button size="sm" variant="outline" onClick={() => setBaixa({ id: p.id, nome: null, valor_final: Number(p.valor_final), resumo: resumo(p) })}>
                  Dar baixa
                </Button>
              )}
            </TableCell>
          )}
        </TableRow>
      ))}
      <DarBaixaPedidoDialog pedido={baixa} onOpenChange={(o) => !o && setBaixa(null)} />
    </>
  );
}
