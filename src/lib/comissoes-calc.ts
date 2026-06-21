export type VendaComissao = {
  valor?: number | null;
  status?: string | null;
};

export type VendedorRanking = {
  nome: string;
  totalVendas: number;
};

export function calcComissao(valorVenda: number, percentual: number): number {
  const raw = ((Number(valorVenda) || 0) * (Number(percentual) || 0)) / 100;
  return Math.round(raw * 100) / 100;
}

export function calcComissaoTotal(vendas: VendaComissao[], percentual: number): number {
  const total = vendas
    .filter((v) => (v.status ?? "").toLowerCase() !== "cancelado")
    .reduce((s, v) => s + calcComissao(Number(v.valor) || 0, percentual), 0);
  return Math.round(total * 100) / 100;
}

export function calcRanking<T extends VendedorRanking>(vendedores: T[]): T[] {
  return [...vendedores].sort((a, b) => b.totalVendas - a.totalVendas);
}
