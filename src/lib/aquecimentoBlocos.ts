// Ordenação e rótulos dos blocos de aquecimento usados nas exportações em PDF.
// As siglas são dinâmicas (categorias do grupo "Aquecimento" no Banco de
// Exercícios); LIB/MOB/ATI/PREV/POT têm ordem e rótulo conhecidos, o restante
// entra depois, em ordem alfabética, usando a própria sigla como rótulo.

export const AQUECIMENTO_ORDEM: string[] = ["LIB", "MOB", "ATI", "PREV", "POT"];

export const AQUECIMENTO_LABELS: Record<string, string> = {
  LIB: "LIBERAÇÃO",
  MOB: "MOBILIDADE",
  ATI: "ATIVAÇÃO",
  PREV: "PREVENTIVOS",
  POT: "POTÊNCIA",
};

/** Rótulo por extenso do bloco; cai na própria sigla quando desconhecido. */
export function aquecimentoLabel(sigla: string): string {
  return AQUECIMENTO_LABELS[sigla] ?? sigla.toUpperCase();
}

/** Ordena siglas de aquecimento pela ordem preferencial, extras no fim. */
export function ordenarBlocosAquecimento(siglas: Iterable<string>): string[] {
  const unicas = Array.from(new Set(Array.from(siglas).filter(Boolean)));
  return unicas.sort((a, b) => {
    const ia = AQUECIMENTO_ORDEM.indexOf(a);
    const ib = AQUECIMENTO_ORDEM.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "pt-BR");
  });
}
