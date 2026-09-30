export type Bandeira = string;
export type Modalidade = 'debito' | 'credito_vista' | 'credito_2_6x' | 'credito_7_12x';
export type PrazoUnidade = 'corridos' | 'uteis';
export type MeioPagamento = 'pix' | 'boleto' | 'dinheiro';

export const BANDEIRAS_PADRAO: { value: Bandeira; label: string }[] = [
  { value: 'visa', label: 'VISA' },
  { value: 'mastercard', label: 'MASTERCARD' },
  { value: 'elo', label: 'ELO' },
];

export const MODALIDADES: { value: Modalidade; label: string; hint?: string }[] = [
  { value: 'debito', label: 'Débito' },
  { value: 'credito_vista', label: 'Crédito à vista', hint: 'Recorrência REDE' },
  { value: 'credito_2_6x', label: 'Crédito parcelado 2–6x' },
  { value: 'credito_7_12x', label: 'Crédito parcelado 7–12x' },
];

export const MODALIDADES_PARCELADAS: Modalidade[] = ['credito_2_6x', 'credito_7_12x'];

export interface AdquirenteTaxa {
  id: string;
  adquirente: string;
  bandeira: Bandeira;
  modalidade: Modalidade;
  taxa_percentual: number;
  prazo_recebimento_dias: number | null;
  prazo_unidade: PrazoUnidade;
  intervalo_parcelas_dias: number | null;
  ativo: boolean;
  updated_at: string;
}

export interface AdquirenteConfig {
  adquirente: string;
  aluguel_mensal: number;
  bandeira_padrao: Bandeira;
  ativo: boolean;
  updated_at: string;
}

export interface MeioPagamentoConfig {
  meio: MeioPagamento;
  taxa_percentual: number;
  prazo_recebimento_dias: number;
  prazo_unidade: PrazoUnidade;
  ativo: boolean;
  updated_at: string;
}
