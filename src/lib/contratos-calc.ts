export type PlanoTipo = 'start' | 'start_plus' | 'power' | 'pro' | 'max' | 'corrida' | 'outro';
export type FormaPagamento =
  | 'cartao_recorrencia'
  | 'cartao_parcelado'
  | 'pix_automatico'
  | 'boleto'
  | 'maquina_debito'
  | 'maquina_credito'
  | 'dinheiro';

export interface Contrato {
  id: string;
  plano_tipo: PlanoTipo;
  vigencia_tipo: 'mensal' | 'anual';
  forma_pagamento: FormaPagamento;
  data_inicio: string;
  data_fim: string | null;
  valor_base: number;
  valor_cobrado: number;
  taxa_recorrencia: number;
  parcelas: number;
  status: string;
  creditos_total: number;
}

export interface ServicoUtilizado {
  tipo: 'nutricao' | 'fisioterapia';
  utilizado: boolean;
}

export interface ResultadoRescisao {
  tipo: 'start_sem_multa' | 'recorrencia_com_multa' | 'parcelado_com_restituicao';
  mes_atual: number;
  meses_restantes: number;
  percentual: number;
  // Recorrência
  valor_vincendo?: number;
  multa_base?: number;
  servicos_vincendos?: number;
  total_devido: number;
  // Parcelado
  valor_total_contrato?: number;
  valor_proporcional?: number;
  restituicao_bruta?: number;
  deducao_servicos?: number;
  total_restituir: number;
  saldo_devedor?: number;
}

export function calcMesAtual(dataInicio: string): number {
  const inicio = new Date(dataInicio);
  const hoje = new Date();
  const meses =
    (hoje.getFullYear() - inicio.getFullYear()) * 12 +
    (hoje.getMonth() - inicio.getMonth()) +
    1;
  return Math.min(Math.max(meses, 1), 12);
}

export function calcPercentualMulta(mesAtual: number): number {
  if (mesAtual <= 4) return 25;
  if (mesAtual <= 6) return 20;
  return 15;
}

export function calcPercentualRestituicao(mesAtual: number): number {
  if (mesAtual <= 4) return 75;
  if (mesAtual <= 6) return 80;
  return 85;
}

export function calcValorServicos(servicos: ServicoUtilizado[]): number {
  return servicos.reduce((acc, s) => {
    if (!s.utilizado) return acc;
    return acc + (s.tipo === 'nutricao' ? 300 : 150);
  }, 0);
}

export function calcRescisao(
  contrato: Contrato,
  servicos: ServicoUtilizado[],
): ResultadoRescisao {
  if (contrato.vigencia_tipo === 'mensal') {
    return {
      tipo: 'start_sem_multa',
      mes_atual: 0,
      meses_restantes: 0,
      percentual: 0,
      total_devido: 0,
      total_restituir: 0,
    };
  }

  const mesAtual = calcMesAtual(contrato.data_inicio);
  const mesesRestantes = Math.max(12 - mesAtual, 0);
  const valorServicos = calcValorServicos(servicos);

  if (
    contrato.forma_pagamento === 'cartao_recorrencia' ||
    contrato.forma_pagamento === 'pix_automatico'
  ) {
    const percentual = calcPercentualMulta(mesAtual);
    const valorVincendo = mesesRestantes * contrato.valor_cobrado;
    const multaBase = Math.round(valorVincendo * (percentual / 100) * 100) / 100;
    const servicosVincendos =
      Math.round((valorServicos / 12) * mesesRestantes * 100) / 100;
    return {
      tipo: 'recorrencia_com_multa',
      mes_atual: mesAtual,
      meses_restantes: mesesRestantes,
      percentual,
      valor_vincendo: valorVincendo,
      multa_base: multaBase,
      servicos_vincendos: servicosVincendos,
      total_devido: Math.round((multaBase + servicosVincendos) * 100) / 100,
      total_restituir: 0,
    };
  }

  const percentual = calcPercentualRestituicao(mesAtual);
  const valorTotalContrato = contrato.valor_cobrado * contrato.parcelas;
  const valorProporcional =
    Math.round((mesesRestantes / 12) * valorTotalContrato * 100) / 100;
  const restituicaoBruta =
    Math.round(valorProporcional * (percentual / 100) * 100) / 100;
  const totalRestituir = Math.max(
    Math.round((restituicaoBruta - valorServicos) * 100) / 100,
    0,
  );
  const saldoDevedor = Math.max(
    Math.round((valorServicos - restituicaoBruta) * 100) / 100,
    0,
  );

  return {
    tipo: 'parcelado_com_restituicao',
    mes_atual: mesAtual,
    meses_restantes: mesesRestantes,
    percentual,
    valor_total_contrato: valorTotalContrato,
    valor_proporcional: valorProporcional,
    restituicao_bruta: restituicaoBruta,
    deducao_servicos: valorServicos,
    total_restituir: totalRestituir,
    saldo_devedor: saldoDevedor,
    total_devido: saldoDevedor,
  };
}

export function calcCreditosPorFrequencia(
  frequencia: number,
  vigencia: 'mensal' | 'anual',
): number {
  const tabela: Record<number, { mensal: number; anual: number }> = {
    1: { mensal: 4, anual: 52 },
    2: { mensal: 8, anual: 104 },
    3: { mensal: 12, anual: 156 },
    0: { mensal: 20, anual: 260 },
  };
  return tabela[frequencia]?.[vigencia] ?? 0;
}

export const LABEL_PLANO: Record<PlanoTipo, string> = {
  start: 'Start',
  start_plus: 'Start+',
  power: 'Power',
  pro: 'Pro',
  max: 'Max',
  corrida: 'Grupo de Corrida',
  outro: 'Outro',
};

export const LABEL_PAGAMENTO: Record<FormaPagamento, string> = {
  cartao_recorrencia: 'Cartão em Recorrência',
  cartao_parcelado: 'Cartão Parcelado',
  pix_automatico: 'Pix Automático',
  boleto: 'Boleto',
  maquina_debito: 'Máquina — Débito',
  maquina_credito: 'Máquina — Crédito',
  dinheiro: 'Dinheiro',
};

export const LABEL_STATUS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-600' },
  suspenso: { label: 'Suspenso', color: 'bg-yellow-500' },
  inadimplente: { label: 'Inadimplente', color: 'bg-red-600' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500' },
  encerrado: { label: 'Encerrado', color: 'bg-gray-400' },
};

export const TRANCAMENTO_MAXIMO: Record<PlanoTipo, { normal: number; doenca: number }> = {
  start: { normal: 0, doenca: 30 },
  start_plus: { normal: 10, doenca: 30 },
  power: { normal: 15, doenca: 30 },
  pro: { normal: 20, doenca: 30 },
  max: { normal: 30, doenca: 30 },
  corrida: { normal: 0, doenca: 30 },
  outro: { normal: 0, doenca: 30 },
};
