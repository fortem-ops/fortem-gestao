/**
 * Formas de RECEBIMENTO (como o dinheiro entrou de fato).
 * Usadas ao dar baixa em uma cobrança. Diferente da forma combinada na venda,
 * que pode ficar como "pendente" (a definir) até o recebimento.
 */
export interface FormaRecebimento {
  /** valor gravado em cobrancas.forma_pagamento */
  value: string;
  label: string;
  /** valor gravado em cobrancas.gateway (respeita o check constraint) */
  gateway: "dinheiro" | "inter_pix" | "maquina" | "rede" | "boleto";
  /** slug correspondente em formas_pagamento (usado em vendas.forma_pagamento) */
  vendaForma: string;
}

export const FORMAS_RECEBIMENTO: FormaRecebimento[] = [
  { value: "dinheiro", label: "Dinheiro", gateway: "dinheiro", vendaForma: "dinheiro" },
  { value: "pix", label: "Pix", gateway: "inter_pix", vendaForma: "pix" },
  { value: "maquina_debito", label: "Cartão de débito (máquina)", gateway: "maquina", vendaForma: "cartao_debito" },
  { value: "maquina_credito", label: "Cartão de crédito (máquina)", gateway: "maquina", vendaForma: "cartao_credito" },
  { value: "cartao_credito_online", label: "Cartão de crédito (online)", gateway: "rede", vendaForma: "cartao_credito" },
  { value: "boleto", label: "Boleto", gateway: "boleto", vendaForma: "boleto" },
];

export const getFormaRecebimento = (value: string): FormaRecebimento | undefined =>
  FORMAS_RECEBIMENTO.find((f) => f.value === value);

const EXTRA_LABELS: Record<string, string> = {
  pendente: "A definir",
  cartao_recorrencia: "Cartão em Recorrência",
  cartao_parcelado: "Cartão Parcelado",
  pix_automatico: "Pix Automático",
  cartao_credito: "Cartão de Crédito",
  cartao_credito_maquininha: "Cartão de Crédito (máquina)",
  cartao_debito: "Cartão de Débito",
  debito: "Cartão de Débito",
  plataforma_agregadora: "Plataforma Agregadora",
};

/** Rótulo amigável para qualquer forma de pagamento/recebimento armazenada. */
export function labelFormaPagamento(value?: string | null): string {
  if (!value) return "—";
  return getFormaRecebimento(value)?.label ?? EXTRA_LABELS[value] ?? value;
}
