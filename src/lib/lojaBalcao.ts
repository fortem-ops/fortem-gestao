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
