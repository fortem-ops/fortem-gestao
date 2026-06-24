export type PlanoTipo = 'start' | 'start_plus' | 'power' | 'pro' | 'max' | 'corrida' | 'gympass' | 'wellhub' | 'totalpass' | 'outro';
export type VigenciaTipo = 'mensal' | 'anual';
export type FormaPagamento = 'cartao_recorrencia' | 'cartao_parcelado' | 'pix_automatico' | 'boleto' | 'maquina_debito' | 'maquina_credito' | 'dinheiro';
export type ContratoStatus = 'ativo' | 'suspenso' | 'cancelado' | 'inadimplente' | 'encerrado';
export type CobrancaStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'isento';
export type CicloStatus = 'ativo' | 'suspenso' | 'expirado' | 'cancelado';
export type InadimplenciaStatus = 'aberta' | 'regularizada' | 'cancelada';
export type Gateway = 'rede' | 'inter_pix' | 'boleto' | 'maquina' | 'dinheiro';

export interface Contrato {
  id: string;
  aluno_id: string;
  plano_id?: string | null;
  plano_tipo: PlanoTipo;
  frequencia_semanal: 0 | 1 | 2 | 3;
  creditos_total: number;
  vigencia_tipo: VigenciaTipo;
  data_inicio: string;
  data_fim?: string | null;
  data_renovacao?: string | null;
  forma_pagamento: FormaPagamento;
  valor_base: number;
  valor_cobrado: number;
  taxa_recorrencia: number;
  parcelas: number;
  status: ContratoStatus;
  indice_reajuste?: string | null;
  percentual_reajuste?: number | null;
  multa_percentual?: number | null;
  cartao_token_id?: string | null;
  notificacao_30d_enviada: boolean;
  motivo_cancelamento?: string | null;
  data_cancelamento?: string | null;
  criado_por?: string | null;
  created_at: string;
  updated_at: string;
  alunos?: { id: string; nome: string; email?: string };
}

export interface Cobranca {
  id: string;
  contrato_id: string;
  aluno_id: string;
  numero_ciclo: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: CobrancaStatus;
  forma_pagamento: string;
  meio_registro: string;
  gateway?: Gateway | null;
  tid?: string | null;
  comprovante_url?: string | null;
  registrado_por?: string | null;
  created_at: string;
}

export interface CicloCredito {
  id: string;
  contrato_id: string;
  cobranca_id?: string | null;
  creditos_liberados: number;
  creditos_usados: number;
  data_inicio: string;
  data_fim?: string | null;
  status: CicloStatus;
  created_at: string;
}

export interface Inadimplencia {
  id: string;
  contrato_id: string;
  cobranca_id: string;
  aluno_id: string;
  data_vencimento: string;
  valor: number;
  dias_atraso?: number;
  status: InadimplenciaStatus;
  data_regularizacao?: string | null;
  notificacoes: Record<string, string | null>;
  created_at: string;
}

export interface ResultadoRescisao {
  tipo: 'start_sem_multa' | 'recorrencia_com_multa' | 'parcelado_com_restituicao';
  plano_tipo: PlanoTipo;
  data_inicio: string;
  data_fim?: string;
  mes_atual?: number;
  meses_restantes?: number;
  valor_mensalidade?: number;
  taxa_recorrencia?: number;
  valor_vincendo?: number;
  percentual_multa?: number;
  multa_base?: number;
  servicos_utilizados?: number;
  servicos_vincendos?: number;
  valor_total_contrato?: number;
  valor_proporcional?: number;
  percentual_restituicao?: number;
  restituicao_bruta?: number;
  deducao_servicos?: number;
  total_restituir: number;
  total_devido: number;
  saldo_devedor?: number;
  descricao: string;
}

export const PLANO_LABELS: Record<PlanoTipo, string> = {
  start: 'Start', start_plus: 'Start+', power: 'Power',
  pro: 'Pro', max: 'Max', corrida: 'Grupo de Corrida',
  gympass: 'Gympass', wellhub: 'Wellhub', totalpass: 'Totalpass', outro: 'Outro',
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  cartao_recorrencia: 'Cartão Recorrência',
  cartao_parcelado: 'Cartão Parcelado',
  pix_automatico: 'Pix Automático',
  boleto: 'Boleto',
  maquina_debito: 'Máquina Débito',
  maquina_credito: 'Máquina Crédito 1x',
  dinheiro: 'Dinheiro',
};

export const STATUS_CONTRATO_LABELS: Record<ContratoStatus, string> = {
  ativo: 'Ativo', suspenso: 'Suspenso', cancelado: 'Cancelado',
  inadimplente: 'Inadimplente', encerrado: 'Encerrado',
};

export const FREQUENCIA_LABELS: Record<number, string> = {
  0: 'Livre', 1: '1x/semana', 2: '2x/semana', 3: '3x/semana',
};

export const formatBRL = (v?: number | null) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
