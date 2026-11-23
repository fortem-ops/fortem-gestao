/** Regras da renovação antecipada de plano (botão no card do plano). */
export type PlanoRenovavel = { ativo: boolean | null };

export type ContextoRenovacao = {
  isAdmin: boolean;
  plano: PlanoRenovavel | null | undefined;
  /** Plano Semestral (catálogo com agregadora_requerida): renovação própria. */
  semestral: boolean;
  /** Plano dentro de um grupo de Pix Automático: renovação própria. */
  emGrupoPix: boolean;
  /** Checagens de Semestral/grupo ainda não confirmadas no servidor. */
  carregando: boolean;
};

/** Só admin, plano ativo, fora do Semestral e do Pix Automático por grupo. */
export function podeRenovarAntecipado(c: ContextoRenovacao): boolean {
  if (!c.isAdmin || !c.plano || c.plano.ativo !== true) return false;
  if (c.carregando) return false;
  return !c.semestral && !c.emGrupoPix;
}

/** Data de início sugerida: hoje (editável para passado ou futuro). */
export function inicioSugeridoRenovacao(agora: Date = new Date()): Date {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}
