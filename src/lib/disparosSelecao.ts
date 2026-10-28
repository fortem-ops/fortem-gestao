// Seleção do passo "Público" (Disparos avulsos). Funções puras.
// Regras: nomes marcados manualmente (ids) NUNCA são zerados por mudança de
// filtro (chips, exclusões, datas, busca); só "Limpar seleção" e o × removem.
// Modo "todos" depende do filtro: qualquer mudança desliga "todos" e zera removidos.

export type Selecao = { todos: boolean; ids: Set<string>; removidos: Set<string>; nomes: Map<string, string> };

export const selecaoVazia = (): Selecao => ({ todos: false, ids: new Set(), removidos: new Set(), nomes: new Map() });

export function aoMudarRecorte(s: Selecao): Selecao {
  return aoMudarBusca(s);
}

export function aoMudarBusca(s: Selecao): Selecao {
  if (!s.todos) return s;
  return { ...s, todos: false, removidos: new Set() };
}

export function marcarIds(s: Selecao, linhas: { id: string; nome: string }[], marcar: boolean): Selecao {
  const ids = new Set(s.ids);
  const nomes = new Map(s.nomes);
  for (const l of linhas) {
    if (marcar) { ids.add(l.id); nomes.set(l.id, l.nome); }
    else { ids.delete(l.id); nomes.delete(l.id); }
  }
  return { ...s, ids, nomes };
}

export function limparIds(s: Selecao): Selecao {
  return { ...s, ids: new Set(), nomes: new Map() };
}

/** Busca salva no filtro: no modo ids a lista de ids é a fonte da verdade, então a busca vai vazia. */
export function buscaParaSalvar(todos: boolean, busca: string): string {
  return todos ? busca : "";
}

export type FiltroSalvo<C extends string = string> = { chips: C[]; busca: string; exclConfirmados: boolean; exclSemContato: boolean; clienteDesdeDe: string | null; clienteDesdeAte: string | null };

/** Filtro salvo na campanha. No modo ids os ids vêm de recortes diferentes: o servidor
 * recebe todos os chips, busca vazia e datas nulas, mantendo só as exclusões das caixas. */
export function filtroParaSalvar<C extends string>(modoTodos: boolean, f: FiltroSalvo<C>, todosOsChips: C[]): FiltroSalvo<C> {
  if (modoTodos) return { ...f };
  return { chips: [...todosOsChips], busca: "", exclConfirmados: f.exclConfirmados, exclSemContato: f.exclSemContato, clienteDesdeDe: null, clienteDesdeAte: null };
}
