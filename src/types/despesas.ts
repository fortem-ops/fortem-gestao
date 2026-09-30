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
  created_at: string;
  updated_at: string;
}

export interface DespesaInput {
  categoria_id: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  tipo: DespesaTipo;
  status: DespesaStatus;
  observacao: string | null;
}

export const TIPO_LABELS: Record<DespesaTipo, string> = { fixa: 'Fixa', variavel: 'Variável' };
export const STATUS_LABELS: Record<DespesaStatus, string> = { pago: 'Pago', pendente: 'Pendente' };
