/** Último dia do mês da data informada, em yyyy-mm-dd. */
export function ultimoDiaDoMes(hoje: Date = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A nova data de término precisa ser depois do término atual. */
export function novaDataFimValida(novaData: string, dataFimAtual: string | null): boolean {
  if (!novaData) return false;
  return !dataFimAtual || novaData > dataFimAtual;
}
