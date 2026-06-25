export type Bandeira = 'visa' | 'mastercard' | 'elo';
export type Modalidade = 'debito' | 'credito_vista' | 'credito_2_6x' | 'credito_7_12x';

export const BANDEIRAS: { value: Bandeira; label: string }[] = [
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

export interface AdquirenteTaxa {
  id: string;
  adquirente: string;
  bandeira: Bandeira;
  modalidade: Modalidade;
  taxa_percentual: number;
  prazo_recebimento_dias: number | null;
  ativo: boolean;
  updated_at: string;
}

export interface AdquirenteConfig {
  adquirente: string;
  aluguel_mensal: number;
  ativo: boolean;
  updated_at: string;
}
