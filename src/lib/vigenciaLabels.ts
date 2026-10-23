/**
 * Rótulos de vigência para os valores novos (Consultoria Online 2027).
 * Só ACRESCENTA casos: para contratos antigos retorna null e cada tela
 * continua usando exatamente o texto que já mostrava.
 */
export const VIGENCIA_LABELS: Record<string, string> = {
  mensal: "Mensal",
  quadrimestral: "4 meses",
  semestral: "Semestral",
  anual: "Anual",
};

export const VIGENCIA_MESES: Record<string, number> = {
  mensal: 1,
  quadrimestral: 4,
  semestral: 6,
  anual: 12,
};

export function ehConsultoria(planoTipo?: string | null): boolean {
  return planoTipo === "consultoria_2027";
}

/** Rótulo novo, ou null quando a tela deve manter o texto legado. */
export function rotuloVigenciaNovo(
  vigencia?: string | null,
  planoTipo?: string | null,
): string | null {
  if (!vigencia) return null;
  if (vigencia === "quadrimestral" || ehConsultoria(planoTipo)) {
    return VIGENCIA_LABELS[vigencia] ?? null;
  }
  return null;
}
