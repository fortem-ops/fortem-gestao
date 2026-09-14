// Parcelamento sem juros da Loja, por faixa de valor do pedido.
export const FAIXAS_PARCELAMENTO: { minimo: number; parcelas: number }[] = [
  { minimo: 0, parcelas: 1 },
  { minimo: 100, parcelas: 2 },
  { minimo: 200, parcelas: 3 },
  { minimo: 400, parcelas: 4 },
  { minimo: 600, parcelas: 5 },
  { minimo: 800, parcelas: 6 },
];

export const parcelasMaximas = (valor: number): number => {
  const v = Number(valor) || 0;
  let max = 1;
  for (const faixa of FAIXAS_PARCELAMENTO) {
    if (v >= faixa.minimo) max = faixa.parcelas;
  }
  return max;
};

export const valorParcela = (valor: number, parcelas: number): number =>
  parcelas > 0 ? (Number(valor) || 0) / parcelas : Number(valor) || 0;

// Próximo degrau da tabela: quanto falta e quantas parcelas isso liberaria.
export const proximaFaixaParcelamento = (
  valor: number,
): { falta: number; parcelas: number } | null => {
  const v = Number(valor) || 0;
  const proxima = FAIXAS_PARCELAMENTO.find((f) => v < f.minimo);
  if (!proxima) return null;
  return { falta: proxima.minimo - v, parcelas: proxima.parcelas };
};
