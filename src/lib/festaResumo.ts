export type AcompanhanteFesta = { id: string; nome: string; consumo: string[] | null; intolerancias: string[] | null };
export type ConfirmacaoFesta = {
  id: string; nome: string; whatsapp: string; email: string | null; vinculo: string;
  consumo: string[] | null; intolerancias: string[] | null; status: string; origem: string;
  total_centavos: number; pago_em: string | null; pago_valor_centavos: number | null;
  pagamento_forma: string | null; observacao: string | null; criado_em: string;
  festa_acompanhantes: AcompanhanteFesta[];
};

/** Totais da tela da equipe. Confirmadas = pagas + isentas (inclui manuais). */
export function resumoFesta(itens: ConfirmacaoFesta[]) {
  const r = { pessoasConfirmadas: 0, pessoasAguardando: 0, confirmacoesAguardando: 0, recebidoCentavos: 0, aReceberCentavos: 0, consumo: {} as Record<string, number>, intolerancias: {} as Record<string, number> };
  for (const c of itens) {
    if (c.status === "cancelado") continue;
    const pessoas = 1 + c.festa_acompanhantes.length;
    if (c.status === "confirmado" || c.status === "isento") r.pessoasConfirmadas += pessoas;
    if (c.status === "confirmado") r.recebidoCentavos += c.pago_valor_centavos ?? c.total_centavos;
    if (c.status === "aguardando_pagamento") { r.pessoasAguardando += pessoas; r.confirmacoesAguardando++; r.aReceberCentavos += c.total_centavos; }
    for (const p of [c, ...c.festa_acompanhantes]) {
      (p.consumo ?? []).forEach((v) => (r.consumo[v] = (r.consumo[v] ?? 0) + 1));
      (p.intolerancias ?? []).forEach((v) => (r.intolerancias[v] = (r.intolerancias[v] ?? 0) + 1));
    }
  }
  return r;
}
