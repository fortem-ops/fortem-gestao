// Seleção do passo "Público" (Disparos avulsos). Funções puras.
// Regras: a busca NÃO zera a seleção manual por ids; mudar o recorte (chips,
// exclusões, datas) zera tudo; modo "todos" depende da busca, então mudar a
// busca com "todos" ligado desliga "todos" e zera removidos, mantendo ids.

export type Selecao = { todos: boolean; ids: Set<string>; removidos: Set<string>; nomes: Map<string, string> };

export const selecaoVazia = (): Selecao => ({ todos: false, ids: new Set(), removidos: new Set(), nomes: new Map() });

export function aoMudarRecorte(_s: Selecao): Selecao {
  return selecaoVazia();
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
