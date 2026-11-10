// Pix Automático por grupo de itens (Etapa 1): cálculos exibidos na tela.
// O banco recalcula soma e vencimento; aqui é só a prévia para a equipe.

export type ItemPixTipo = "contrato" | "plano";

export interface ItemPixDisponivel {
  tipo: ItemPixTipo;
  id: string;
  descricao: string | null;
  valor: number | string;
  forma_pagamento: string | null;
  vencimento: string | null;
  vinculado_grupo: string | null;
}

/** Margem do teto sugerido sobre a soma dos itens (decisão do dono: +15%, editável). */
export const MARGEM_TETO = 0.15;

const centavos = (v: number | string) => Math.round(Number(v) * 100);

export function somaItens(itens: Pick<ItemPixDisponivel, "valor">[]): number {
  return itens.reduce((s, i) => s + centavos(i.valor), 0) / 100;
}

export function tetoSugerido(soma: number): number {
  return Math.round(centavos(soma) * (1 + MARGEM_TETO)) / 100;
}

/** Dia do débito: sempre o vencimento mais próximo entre os itens ligados. */
export function diaDebito(itens: Pick<ItemPixDisponivel, "vencimento">[]): string | null {
  const datas = itens.map((i) => i.vencimento).filter((d): d is string => !!d).sort();
  return datas[0] ?? null;
}

export type GrupoPixStatus = "rascunho" | "aguardando_autorizacao" | "ativa" | "falha" | "cancelada";

export const MAX_CODIGOS = 3;

export function podeGerarCodigo(status: GrupoPixStatus, codigosGerados: number): boolean {
  return ["rascunho", "aguardando_autorizacao", "falha"].includes(status) && codigosGerados < MAX_CODIGOS;
}
