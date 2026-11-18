// Regras da venda de produtos no balcão (espelham fn_loja_venda_balcao; o servidor decide).
export type TipoDesconto = "valor" | "percentual";

export function calcularDesconto(total: number, tipo: TipoDesconto, valor: number): number {
  const v = Math.max(0, Number.isFinite(valor) ? valor : 0);
  if (tipo === "percentual") return Math.round(total * Math.min(v, 100)) / 100;
  return Math.min(v, total);
}

export type SituacaoItem = "disponivel" | "encomenda" | "bloqueado";

export function situacaoItem(disponivel: number, quantidade: number, permiteEncomenda: boolean): SituacaoItem {
  if (disponivel >= quantidade) return "disponivel";
  return permiteEncomenda ? "encomenda" : "bloqueado";
}

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function filtrarProdutos<T extends { nome: string; detalhe: string }>(itens: T[], busca: string): T[] {
  const q = normalizar(busca);
  if (!q) return itens;
  return itens.filter((i) => normalizar(`${i.nome} ${i.detalhe}`).includes(q));
}

export function podeDarBaixaPedido(status: string): boolean {
  return status === "aguardando_pagamento";
}

const STATUS_PEDIDO: Record<string, string> = {
  pago: "Pago", aguardando_pagamento: "Pendente", cancelado: "Cancelado", expirado: "Expirado", estornado: "Estornado",
};
export function statusPedidoLabel(status: string): string {
  return STATUS_PEDIDO[status] ?? status;
}
