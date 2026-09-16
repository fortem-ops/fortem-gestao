import { supabase } from "@/integrations/supabase/client";

/**
 * O PostgREST corta qualquer resposta em 1.000 linhas. Para tabelas que já
 * passam (ou podem passar) disso, é obrigatório paginar com `range` e uma
 * ordenação ESTÁVEL — caso contrário linhas se repetem ou somem entre páginas.
 */
export const TAMANHO_PAGINA_PADRAO = 1000;
export const MAX_PAGINAS_PADRAO = 20;

export interface OrdenacaoPaginada {
  coluna: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

export interface CarregarTodasAsPaginasOpts {
  /** Nome da tabela. */
  tabela: string;
  /** Colunas do select (padrão: "*"). */
  colunas?: string;
  /**
   * Ordenação estável. Informe pelo menos uma coluna; quando a primeira puder
   * empatar, acrescente uma coluna única (normalmente "id").
   */
  ordenarPor: OrdenacaoPaginada[];
  /** Callback opcional para aplicar filtros (eq, in, gte...) na query. */
  filtros?: <Q>(query: Q) => Q;
  tamanhoPagina?: number;
  maxPaginas?: number;
}

/** Busca a tabela inteira em páginas de 1.000 linhas, até a página vir incompleta. */
export async function carregarTodasAsPaginas<T>({
  tabela,
  colunas = "*",
  ordenarPor,
  filtros,
  tamanhoPagina = TAMANHO_PAGINA_PADRAO,
  maxPaginas = MAX_PAGINAS_PADRAO,
}: CarregarTodasAsPaginasOpts): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const inicio = pagina * tamanhoPagina;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(tabela as any).select(colunas);
    if (filtros) query = filtros(query);
    for (const o of ordenarPor) {
      query = query.order(o.coluna, {
        ascending: o.ascending ?? true,
        ...(o.nullsFirst === undefined ? {} : { nullsFirst: o.nullsFirst }),
      });
    }
    const { data, error } = await query.range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw error;
    const linhas = (data ?? []) as T[];
    todas.push(...linhas);
    if (linhas.length < tamanhoPagina) return todas;
  }
  console.warn(
    `[supabasePaginado] limite de ${maxPaginas} páginas atingido em ${tabela}; os dados podem estar incompletos.`,
  );
  return todas;
}
