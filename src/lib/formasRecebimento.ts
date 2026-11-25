import type { Modalidade } from "@/types/adquirente";

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
  /** quando true, a baixa exige informar a bandeira do cartão */
  exigeBandeira?: boolean;
  /** quando true, a baixa permite informar o número de parcelas (1 a 12) */
  permiteParcelas?: boolean;
}

export const FORMAS_RECEBIMENTO: FormaRecebimento[] = [
  { value: "dinheiro", label: "Dinheiro", gateway: "dinheiro", vendaForma: "dinheiro" },
  { value: "pix", label: "Pix", gateway: "inter_pix", vendaForma: "pix" },
  { value: "maquina_debito", label: "Cartão de débito (máquina)", gateway: "maquina", vendaForma: "cartao_debito", exigeBandeira: true },
  { value: "maquina_credito", label: "Cartão de crédito (máquina)", gateway: "maquina", vendaForma: "cartao_credito", exigeBandeira: true, permiteParcelas: true },
  { value: "cartao_credito_online", label: "Cartão de crédito (online)", gateway: "rede", vendaForma: "cartao_credito" },
  { value: "boleto", label: "Boleto", gateway: "boleto", vendaForma: "boleto" },
];

export const getFormaRecebimento = (value: string): FormaRecebimento | undefined =>
  FORMAS_RECEBIMENTO.find((f) => f.value === value);

export const formaExigeBandeira = (value: string): boolean =>
  Boolean(getFormaRecebimento(value)?.exigeBandeira);

export const formaPermiteParcelas = (value: string): boolean =>
  Boolean(getFormaRecebimento(value)?.permiteParcelas);

/** Modalidade da adquirente usada no cálculo de taxa/prazo dos recebíveis. */
export function modalidadeAdquirente(forma: string, parcelas?: number | null): Modalidade | null {
  if (forma === "maquina_debito" || forma === "cartao_debito" || forma === "debito") {
    return "debito";
  }
  if (forma === "maquina_credito" || forma === "cartao_recorrencia" || forma === "cartao_credito_online") {
    const p = parcelas ?? 1;
    if (p >= 7) return "credito_7_12x";
    if (p >= 2) return "credito_2_6x";
    return "credito_vista";
  }
  return null;
}

/** Valida os campos extras de cartão na baixa manual. Retorna erro ou null se válido. */
export function validarBaixaCartao(
  forma: string,
  bandeira?: string | null,
  parcelas?: number | null,
): string | null {
  if (formaExigeBandeira(forma) && (!bandeira || !bandeira.trim())) {
    return "Selecione a bandeira do cartão.";
  }
  if (formaPermiteParcelas(forma)) {
    const p = parcelas ?? 1;
    if (!Number.isInteger(p) || p < 1 || p > 12) {
      return "Informe um número de parcelas entre 1 e 12.";
    }
  }
  return null;
}

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
