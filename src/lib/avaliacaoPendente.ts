export interface AvaliacaoParaLembrete {
  aluno_id: string;
  tipo: string | null;
  data: string;
  dados?: unknown;
}

export interface PartesAvaliacaoConcluidas {
  funcional: boolean;
  forca: boolean;
  experimental: boolean;
}

function dadosComoObjeto(dados: unknown): Record<string, unknown> {
  return dados && typeof dados === "object" && !Array.isArray(dados)
    ? (dados as Record<string, unknown>)
    : {};
}

function temItens(valor: unknown): boolean {
  return Array.isArray(valor) && valor.length > 0;
}

/** Identifica as partes preenchidas após um agendamento, incluindo a Avaliação Premium. */
export function partesAvaliacaoConcluidas(
  avaliacoes: AvaliacaoParaLembrete[],
  alunoId: string,
  dataAgendamento: string,
): PartesAvaliacaoConcluidas {
  const concluidas: PartesAvaliacaoConcluidas = {
    funcional: false,
    forca: false,
    experimental: false,
  };

  for (const avaliacao of avaliacoes) {
    if (avaliacao.aluno_id !== alunoId || avaliacao.data < dataAgendamento) continue;

    const tipo = (avaliacao.tipo ?? "").toLowerCase();
    if (tipo === "experimental") concluidas.experimental = true;
    if (tipo === "funcional") concluidas.funcional = true;
    if (tipo === "forca") concluidas.forca = true;

    if (tipo === "funcional_v2") {
      const dados = dadosComoObjeto(avaliacao.dados);
      const forca = dadosComoObjeto(dados.forca);
      if (temItens(dados.metricas)) concluidas.funcional = true;
      if (temItens(forca.exercicios)) concluidas.forca = true;
    }
  }

  return concluidas;
}