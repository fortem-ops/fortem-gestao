/** Diferença em reais (banco − lançado), arredondada ao centavo; 0 quando iguais. */
export function diferencaValor(lancado: number, banco: number): number {
  const d = Math.round(banco * 100) - Math.round(lancado * 100);
  return d / 100;
}

/** Soma valores em reais sem erro de ponto flutuante (arredonda cada item ao centavo). */
export function somaCentavos(valores: number[]): number {
  return valores.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
}
