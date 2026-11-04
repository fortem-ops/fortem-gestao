/** Diferença em reais (banco − lançado), arredondada ao centavo; 0 quando iguais. */
export function diferencaValor(lancado: number, banco: number): number {
  const d = Math.round(banco * 100) - Math.round(lancado * 100);
  return d / 100;
}
