/** Regra de novas confirmações da festa; históricos usam seu total armazenado. */
export const FESTA_PESSOA_CENTAVOS = 7500;

export function totalFesta(acompanhantes: number, isento = false): number {
  if (!Number.isInteger(acompanhantes) || acompanhantes < 0 || acompanhantes > 3) {
    throw new Error("Quantidade de acompanhantes inválida.");
  }
  return isento ? 0 : (1 + acompanhantes) * FESTA_PESSOA_CENTAVOS;
}

/** O total foi recalculado na criação; não reajustar pagamentos históricos. */
export function valorPagoFestaCorreto(valor: unknown, totalCentavos: number): boolean {
  const centavos = Math.round(Number(valor) * 100);
  return Number.isFinite(centavos) && centavos === totalCentavos;
}