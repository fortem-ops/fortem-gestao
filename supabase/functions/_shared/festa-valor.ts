/** Regra de novas confirmações da festa; históricos usam seu total armazenado. */
export const FESTA_PESSOA_CENTAVOS = 7500;

export function totalFesta(acompanhantes: number, isento = false, descontoPessoaCentavos = 0): number {
  if (!Number.isInteger(acompanhantes) || acompanhantes < 0 || acompanhantes > 3) {
    throw new Error("Quantidade de acompanhantes inválida.");
  }
  if (isento) return 0;
  return (1 + acompanhantes) * Math.max(0, FESTA_PESSOA_CENTAVOS - Math.max(0, Math.trunc(descontoPessoaCentavos || 0)));
}

/** O total foi recalculado na criação; não reajustar pagamentos históricos. */
export function valorPagoFestaCorreto(valor: unknown, totalCentavos: number): boolean {
  const centavos = Math.round(Number(valor) * 100);
  return Number.isFinite(centavos) && centavos === totalCentavos;
}