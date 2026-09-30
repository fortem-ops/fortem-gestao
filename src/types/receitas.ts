export type ReceitaStatus = 'recebido' | 'previsto';
export type ReceitaOrigem = 'manual' | 'importado_historico' | 'recorrente';
export type ReceitaForma = 'PIX' | 'BOLETO' | 'DINHEIRO' | 'CARTÃO DE DÉBITO' | 'CARTÃO DE CRÉDITO' | 'REPASSE AGREGADOR';
export type ReceitaConta = 'BANCO INTER' | 'ITAÚ' | 'BANCO DO BRASIL';

export interface ReceitaCategoria {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receita {
  id: string;
  categoria_id: string | null;
  descricao: string;
  valor: number;
  valor_recebido: number | null;
  data_competencia: string;
  data_recebimento: string | null;
  status: ReceitaStatus;
  origem: ReceitaOrigem;
  observacao: string | null;
  recorrente: boolean;
  forma_recebimento: ReceitaForma | null;
  conta_bancaria: ReceitaConta | null;
  conciliado: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReceitaInput {
  categoria_id: string | null;
  descricao: string;
  valor: number;
  valor_recebido: number | null;
  data_competencia: string;
  data_recebimento: string | null;
  status: ReceitaStatus;
  observacao: string | null;
  forma_recebimento: ReceitaForma | null;
  conta_bancaria: ReceitaConta | null;
  conciliado: boolean;
}

export const FORMAS_RECEITA: { value: ReceitaForma; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTÃO DE DÉBITO', label: 'Cartão de Débito' },
  { value: 'CARTÃO DE CRÉDITO', label: 'Cartão de Crédito' },
  { value: 'REPASSE AGREGADOR', label: 'Repasse Agregador' },
];
export const CONTAS_RECEITA: { value: ReceitaConta; label: string }[] = [
  { value: 'BANCO INTER', label: 'Banco Inter' },
  { value: 'ITAÚ', label: 'Itaú' },
  { value: 'BANCO DO BRASIL', label: 'Banco do Brasil' },
];

export const STATUS_RECEITA_LABELS: Record<ReceitaStatus, string> = { recebido: 'Recebido', previsto: 'Previsto' };
