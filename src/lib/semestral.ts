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

/** Resposta de `rede-cobrar-token` para a 1ª mensalidade do Semestral, traduzida para a tela. */
export type RespostaCobranca = {
  success?: boolean; idempotente?: boolean; em_processamento?: boolean; recusado?: boolean;
  return_message?: string | null; error?: string; incerto?: boolean;
};
export type EstadoCobranca = { estado: "aprovado" | "recusado" | "processando" | "erro"; mensagem: string; podeTentarDeNovo: boolean };

export function interpretarCobrancaSemestral(r: RespostaCobranca | null | undefined): EstadoCobranca {
  if (r?.success) return { estado: "aprovado", mensagem: "1ª mensalidade aprovada. Plano Semestral ativado.", podeTentarDeNovo: false };
  if (r?.em_processamento || r?.incerto)
    return { estado: "processando", mensagem: "Há um pagamento em processamento para esta venda. Não cobre de novo; a equipe confere o resultado.", podeTentarDeNovo: false };
  if (r?.recusado)
    return { estado: "recusado", mensagem: `Cartão recusado: ${r.return_message ?? "sem motivo informado"}. Tente de novo ou use outro cartão.`, podeTentarDeNovo: true };
  return { estado: "erro", mensagem: r?.error ?? "Pagamento não confirmado.", podeTentarDeNovo: false };
}

/** Botão de cancelamento do Semestral: só administrador e só contrato Semestral ativo sem cancelamento. */
export function podeCancelarSemestral(
  isAdmin: boolean,
  contrato: { plano_tipo?: string | null; status?: string | null; data_cancelamento?: string | null } | null | undefined,
): boolean {
  return isAdmin && contrato?.plano_tipo === "semestral_2027" && contrato.status === "ativo" && !contrato.data_cancelamento;
}
