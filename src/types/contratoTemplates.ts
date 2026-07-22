import type { PlanoTipo, FormaPagamento } from './financeiro';

export interface ContratoTemplate {
  id: string;
  nome: string;
  plano_tipo: PlanoTipo;
  forma_pagamento: FormaPagamento;
  conteudo: string;
  versao: number;
  ativo: boolean;
  criado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegulamentoInternoVersao {
  id: string;
  conteudo: string;
  versao: number;
  ativo: boolean;
  criado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export const PLANOS_ORDEM: PlanoTipo[] = ['start', 'start_plus', 'power', 'pro', 'max'];

const HOJE = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const MERGE_FIELDS_EXEMPLO: Record<string, string> = {
  NOME: 'Ana Paula Silva',
  CPF: '123.456.789-00',
  RG: '12.345.678-9',
  EMAIL: 'ana.silva@exemplo.com',
  TELEFONE: '(51) 99999-0000',
  ENDERECO: 'Rua Exemplo, 123 — Porto Alegre/RS',
  PLANO: 'Pro',
  FREQUENCIA: '3x/semana',
  VALOR_BASE: 'R$ 499,00',
  VALOR_FINAL_CONTRATO: 'R$ 479,00',
  VALOR_MENSAL: 'R$ 479,00',
  FORMA_PAGAMENTO: 'Cartão Recorrência',
  PARCELAS: '12',
  DATA_INICIO: `${pad(HOJE.getDate())}/${pad(HOJE.getMonth() + 1)}/${HOJE.getFullYear()}`,
  DATA_FIM: `${pad(HOJE.getDate())}/${pad(HOJE.getMonth() + 1)}/${HOJE.getFullYear() + 1}`,
  DIA: pad(HOJE.getDate()),
  MES: MESES_PT[HOJE.getMonth()],
  ANO: String(HOJE.getFullYear()),
  DATA_HOJE: `${pad(HOJE.getDate())}/${pad(HOJE.getMonth() + 1)}/${HOJE.getFullYear()}`,
  CIDADE: 'Porto Alegre',
  ESTADO: 'RS',
};

/** Substitui merge fields %CAMPO% em uma string HTML por valores de exemplo. */
export function aplicarMergeFieldsExemplo(html: string): string {
  return html.replace(/%([A-Z_][A-Z0-9_]*)%/g, (match, key) => {
    return MERGE_FIELDS_EXEMPLO[key] ?? match;
  });
}
