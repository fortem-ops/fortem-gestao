// Plano Semestral (agregadoras). Quem pode comprar e quais itens aparecem vêm só do servidor
// (fn_semestral_itens_elegiveis); aqui ficam apenas regras de exibição e o modelo de contrato.

export type ItemSemestral = {
  id: string;
  codigo: string;
  nome: string;
  nome_exibicao?: string | null;
  valor: number;
  quantidade_creditos?: number | null;
  frequencia?: string | null;
  permite_fixar_horario?: boolean | null;
  bota_compressao_mes?: number | null;
  agregadora_requerida?: string | null;
};

type ItemCatalogo = { familia?: string | null; agregadora_requerida?: string | null };

/** plano_tipo do modelo de contrato: Semestral usa o modelo da sua agregadora; os demais, a família. */
export function planoTipoTemplate(item: ItemCatalogo): string | null | undefined {
  if (item.agregadora_requerida) return `semestral_${item.agregadora_requerida}`;
  return item.familia;
}

/** Listas genéricas do catálogo nunca trazem itens de agregadora (filtro no próprio pedido ao banco). */
export function semItensAgregadora<Q extends { is: (coluna: string, valor: null) => Q }>(q: Q): Q {
  return q.is("agregadora_requerida", null);
}

export function beneficiosSemestral(item: ItemSemestral): string[] {
  const freq = item.frequencia ?? "3x";
  const out = [`${freq}/semana`, `${item.quantidade_creditos ?? 12} créditos por ciclo`];
  if (item.permite_fixar_horario) out.push("Horários fixos");
  if ((item.bota_compressao_mes ?? 0) > 0) out.push(`Bota de compressão ${item.bota_compressao_mes}/ciclo`);
  return out;
}
