import { differenceInYears, parseISO } from "date-fns";

/** Faixas etárias usadas nas bases de referência Fortem (mobilidade/assimetria). */
export type FaixaEtaria = "18-29" | "30-44" | "45+";

export const FAIXAS_ETARIAS: FaixaEtaria[] = ["18-29", "30-44", "45+"];

/** Idade ATUAL do aluno a partir da data de nascimento (null quando não há data). */
export function idadeAtual(dataNascimento: string | null | undefined): number | null {
  if (!dataNascimento) return null;
  const idade = differenceInYears(new Date(), parseISO(dataNascimento));
  return Number.isFinite(idade) ? idade : null;
}

/**
 * Faixa etária a partir da data de nascimento, usando a idade ATUAL.
 * Menor de 18 ou sem data → null (cai no fallback "todos" da referência).
 */
export function faixaEtariaDe(dataNascimento: string | null | undefined): FaixaEtaria | null {
  const idade = idadeAtual(dataNascimento);
  if (idade === null || idade < 18) return null;
  if (idade <= 29) return "18-29";
  if (idade <= 44) return "30-44";
  return "45+";
}
