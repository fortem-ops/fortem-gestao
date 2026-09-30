export type DespesaTipo = 'fixa' | 'variavel';
export type DespesaStatus = 'pago' | 'pendente';
export type DespesaOrigem = 'manual' | 'importado_historico' | 'recorrente';

export interface DespesaCategoria {
  id: string;
  nome: string;
  tipo: DespesaTipo;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Despesa {
  id: string;
  categoria_id: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  tipo: DespesaTipo;
  status: DespesaStatus;
  origem: DespesaOrigem;
  observacao: string | null;
  recorrente: boolean;
  forma_pagamento: DespesaForma | null;
  conta_bancaria: DespesaConta | null;
  valor_pago: number | null;
  conciliado: boolean;
  created_at: string;
  updated_at: string;
}

export type DespesaForma = 'PIX' | 'BOLETO' | 'DINHEIRO' | 'CARTÃO DE DÉBITO' | 'CARTÃO DE CRÉDITO';
export type DespesaConta = 'BANCO INTER' | 'ITAÚ';

export const FORMAS_DESPESA: { value: DespesaForma; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTÃO DE DÉBITO', label: 'Cartão de Débito' },
  { value: 'CARTÃO DE CRÉDITO', label: 'Cartão de Crédito' },
];
export const CONTAS_DESPESA: { value: DespesaConta; label: string }[] = [
  { value: 'BANCO INTER', label: 'Banco Inter' },
  { value: 'ITAÚ', label: 'Itaú' },
];

export interface DespesaInput {
  categoria_id: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  tipo: DespesaTipo;
  status: DespesaStatus;
  observacao: string | null;
  forma_pagamento: DespesaForma | null;
  conta_bancaria: DespesaConta | null;
  valor_pago: number | null;
  conciliado: boolean;
}

export const TIPO_LABELS: Record<DespesaTipo, string> = { fixa: 'Fixa', variavel: 'Variável' };
export const STATUS_LABELS: Record<DespesaStatus, string> = { pago: 'Pago', pendente: 'Pendente' };
