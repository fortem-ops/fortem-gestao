import { supabase } from "@/integrations/supabase/client";

const MENSAGENS: Record<string, string> = {
  nao_autenticado: "Sessão expirada. Entre novamente.",
  sem_permissao: "Apenas coordenação e administração podem estornar.",
  pedido_nao_encontrado: "Pedido não encontrado.",
  pedido_nao_pago: "Só é possível estornar pedidos pagos.",
  pedido_ja_estornado: "Este pedido já foi estornado.",
  pagamento_cartao_nao_encontrado: "Não encontramos a cobrança aprovada no cartão.",
  credenciais_rede_ausentes: "Credenciais do cartão não configuradas.",
  falha_autenticacao_rede: "Falha ao autenticar na operadora do cartão.",
  estorno_recusado_rede: "A operadora do cartão recusou o estorno.",
  cobranca_pix_nao_encontrada: "Não encontramos o PIX liquidado deste pedido.",
  e2e_pix_nao_encontrado: "Não foi possível identificar o PIX recebido no banco.",
  devolucao_pix_recusada: "O banco recusou a devolução do PIX.",
  forma_pagamento_nao_estornavel: "Esta forma de pagamento não permite estorno automático.",
  valor_invalido: "Pedido sem valor a devolver.",
  erro_interno: "Erro inesperado ao estornar.",
};

/** Chama a edge function de estorno e lança erro amigável em caso de falha. */
export async function estornarPedido(pedidoId: string) {
  const { data, error } = await supabase.functions.invoke("loja-estornar-pedido", {
    body: { pedido_id: pedidoId },
  });
  if (error) throw new Error("Não foi possível falar com o servidor de pagamentos.");
  if (!data?.ok) {
    const base = MENSAGENS[data?.error as string] ?? "Não foi possível estornar o pedido.";
    throw new Error(data?.detalhe ? `${base} (${data.detalhe})` : base);
  }
  return data;
}
