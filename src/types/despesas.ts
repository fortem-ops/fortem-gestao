export type DespesaTipo = 'fixa' | 'variavel';
export type DespesaStatus = 'pago' | 'pendente';
export type DespesaOrigem = 'manual' | 'importado_historico' | 'recorrente' | 'automatico';

export type CategoriaNivel = 'central' | 'sub';

export interface DespesaCategoria {
  id: string;
  nome: string;
  tipo: DespesaTipo;
  ativo: boolean;
  /** null = categoria antiga (só histórico, não aparece em lançamentos novos). */
  nivel: CategoriaNivel | null;
  categoria_pai_id: string | null;
  codigo: string | null;
  ordem: number | null;
  created_at: string;
  updated_at: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  tipo_pessoa: 'PF' | 'PJ' | null;
  cpf_cnpj: string | null;
  categoria_padrao_id: string | null;
  eh_funcionario: boolean;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type FornecedorInput = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>;

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
  fornecedor_id: string | null;
  grupo_recorrencia_id: string | null;
  parcela_atual: number | null;
  parcela_total: number | null;
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
  fornecedor_id: string | null;
}

export interface DespesaRecorrenciaInput {
  grupo_recorrencia_id?: string | null;
  parcela_atual?: number | null;
  parcela_total?: number | null;
  recorrente?: boolean;
}

/** Ordena por código hierárquico ("1.10" depois de "1.9"). */
export function compararCodigo(a: string | null, b: string | null) {
  const pa = (a ?? '').split('.').map(Number);
  const pb = (b ?? '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export const TIPO_LABELS: Record<DespesaTipo, string> = { fixa: 'Fixa', variavel: 'Variável' };
export const STATUS_LABELS: Record<DespesaStatus, string> = { pago: 'Pago', pendente: 'Pendente' };
