export type ComissaoTipo = "treino_experimental" | "avaliacao_funcional" | "carteira_ativa";
export type ComissaoStatus = "pendente" | "em_validacao" | "aprovado" | "pago" | "cancelado";
export type PendenciaTipo =
  | "avaliar_experimental"
  | "concluir_avaliacao_funcional"
  | "upload_arquivo_forca"
  | "aguardando_pagamento_plano";

export interface Comissionamento {
  id: string;
  tipo: ComissaoTipo;
  profissional_id: string;
  aluno_id: string | null;
  origem_tabela: string | null;
  origem_id: string | null;
  valor: number;
  status: ComissaoStatus;
  descricao: string | null;
  data_referencia: string;
  data_pagamento: string | null;
  aprovado_por: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComissaoPendencia {
  id: string;
  comissionamento_id: string | null;
  profissional_id: string;
  aluno_id: string | null;
  tipo_pendencia: PendenciaTipo;
  descricao: string | null;
  agenda_id: string | null;
  avaliacao_id: string | null;
  concluido: boolean;
  concluido_em: string | null;
  responsavel_id: string | null;
  created_at: string;
}

export interface ComissaoConfig {
  id: string;
  tipo: ComissaoTipo;
  valor: number;
  meta_minima: number;
  ativo: boolean;
}

export const TIPO_LABEL: Record<ComissaoTipo, string> = {
  treino_experimental: "Treino Experimental",
  avaliacao_funcional: "Avaliação Funcional",
  carteira_ativa: "Carteira Ativa",
};

export const STATUS_LABEL: Record<ComissaoStatus, string> = {
  pendente: "Pendente",
  em_validacao: "Em validação",
  aprovado: "Aprovado",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<ComissaoStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  em_validacao: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  aprovado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  pago: "bg-primary/15 text-primary border-primary/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

export const PENDENCIA_LABEL: Record<PendenciaTipo, string> = {
  avaliar_experimental: "Avaliar Treino Experimental",
  concluir_avaliacao_funcional: "Concluir Avaliação Funcional",
  upload_arquivo_forca: "Upload de arquivo Força",
  aguardando_pagamento_plano: "Aguardando pagamento do plano",
};

export function formatBRL(v: number | null | undefined): string {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
