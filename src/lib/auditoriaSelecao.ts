export interface ItemSelecionavel {
  id: string;
  status: string;
}

/** Ids de todos os itens visíveis que ainda estão abertos. */
export function idsAbertos(itens: ItemSelecionavel[]): Set<string> {
  return new Set(itens.filter((i) => i.status === "aberto").map((i) => i.id));
}

/** Liga/desliga um id, só se o item estiver aberto. */
export function alternarSelecao(sel: Set<string>, item: ItemSelecionavel): Set<string> {
  const novo = new Set(sel);
  if (novo.has(item.id)) novo.delete(item.id);
  else if (item.status === "aberto") novo.add(item.id);
  return novo;
}

/** Mantém só os ids selecionados que ainda estão visíveis e abertos. */
export function loteValido(sel: Set<string>, itens: ItemSelecionavel[]): string[] {
  const abertos = idsAbertos(itens);
  return [...sel].filter((id) => abertos.has(id));
}
