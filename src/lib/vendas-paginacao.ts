export const PAGE_SIZE = 50;

/** Calcula o range Supabase { from, to } para uma página. */
export function calcRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

/** Calcula o total de páginas dado o total de registros. */
export function calcTotalPages(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
}

/** Garante que a página está dentro dos limites válidos [1, totalPages]. */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

/** Retorna true se há página anterior disponível. */
export function hasPrevPage(page: number): boolean {
  return page > 1;
}

/** Retorna true se há próxima página disponível. */
export function hasNextPage(page: number, totalPages: number): boolean {
  return page < totalPages;
}
