// Regras puras da Carteira Consultor: escopo, avaliação funcional e assiduidade.

export type StatusAvaliacaoFuncional = "em_dia" | "pendente" | "atrasada";
export type StatusFrequencia = "assiduo" | "irregular" | "sem_dados";

/** Mesmos cortes usados nos alertas do painel: < 4 meses em dia, 4 a 6 pendente, >= 6 atrasada. */
export function classificarAvaliacaoFuncional(
  ultima: Date | null,
  hoje: Date = new Date(),
): StatusAvaliacaoFuncional {
  if (!ultima) return "atrasada";
  const meses =
    (hoje.getFullYear() - ultima.getFullYear()) * 12 +
    (hoje.getMonth() - ultima.getMonth()) -
    (hoje.getDate() < ultima.getDate() ? 1 : 0);
  if (meses < 4) return "em_dia";
  if (meses < 6) return "pendente";
  return "atrasada";
}

/** Frequência semanal 5 representa "Livre" no cadastro; usamos 3x/semana como base. */
export function frequenciaBaseSemanal(frequenciaSemanal: number | null | undefined): number | null {
  if (!frequenciaSemanal || frequenciaSemanal <= 0) return null;
  return frequenciaSemanal === 5 ? 3 : frequenciaSemanal;
}

/** Assíduo a partir de 75% das sessões previstas nas últimas 4 semanas. */
export function classificarFrequencia(params: {
  sessoes4Semanas: number;
  frequenciaSemanal: number | null | undefined;
  temAgendamentos: boolean;
}): StatusFrequencia {
  const base = frequenciaBaseSemanal(params.frequenciaSemanal);
  if (!base) return "sem_dados";
  if (!params.temAgendamentos && params.sessoes4Semanas === 0) return "sem_dados";
  const previsto = base * 4;
  return params.sessoes4Semanas >= previsto * 0.75 ? "assiduo" : "irregular";
}

/** Uma pessoa vê o aluno quando é professor responsável ou consultor responsável. */
export function pertenceAoEscopo(
  aluno: { responsavel_id?: string | null; consultor_id?: string | null },
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return aluno.responsavel_id === userId || aluno.consultor_id === userId;
}

export const LABEL_AF: Record<StatusAvaliacaoFuncional, string> = {
  em_dia: "Em dia",
  pendente: "Pendente",
  atrasada: "Atrasada",
};

export const LABEL_FREQ: Record<StatusFrequencia, string> = {
  assiduo: "Assíduo",
  irregular: "Irregular",
  sem_dados: "Sem dados",
};
