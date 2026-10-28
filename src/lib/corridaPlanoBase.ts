/** Prioridade para sugerir a variante de Corrida a partir do plano base ativo. */
export const PRIORIDADE_PLANO_BASE = ["max", "pro", "power", "start_plus", "start"] as const;

/** Converte o plano_tipo do contrato (inclui famílias 2027, ex.: start_2027) no plano base. */
export function planoBaseDeContrato(tipo?: string | null): string | null {
  if (!tipo) return null;
  const t = String(tipo).trim().toLowerCase().replace(/_2027$/, "");
  return t === "corrida" ? null : t;
}

export function planoBaseAtivoDe(tipos: (string | null | undefined)[]): string | null {
  const set = new Set(tipos.map(planoBaseDeContrato).filter(Boolean) as string[]);
  return PRIORIDADE_PLANO_BASE.find((t) => set.has(t)) ?? null;
}

/** Escolhe a variante sugerida; sem plano base prefere "Corrida - Sem Plano", nunca Prospect. */
export function sugerirVarianteCorrida<T extends { nome?: string; plano_base_requerido?: string | null; periodo_meses?: number | null }>(
  planos: T[],
  planoBase: string | null,
): T | null {
  if (planos.length === 0) return null;
  let lista = planos.filter((p) => (p.plano_base_requerido ?? null) === planoBase);
  if (!planoBase) {
    const semPlano = lista.filter((p) => p.nome === "Corrida - Sem Plano");
    if (semPlano.length) lista = semPlano;
  }
  if (lista.length === 0) lista = planos;
  return [...lista].sort((a, b) => (a.periodo_meses || 0) - (b.periodo_meses || 0))[0];
}
