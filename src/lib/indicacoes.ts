import { supabase } from "@/integrations/supabase/client";

/** Indicador escolhido no cadastro (vem de fn_indicacao_buscar_indicador). */
export interface IndicadorOpcao {
  aluno_id: string;
  nome: string;
  ativo: boolean;
}

export interface IndicacaoLinha {
  id: string;
  padrinho_id: string;
  padrinho_nome: string;
  padrinho_ativo: boolean;
  indicado_id: string;
  indicado_nome: string;
  indicado_status: string;
  origem: string;
  status: string;
  pontos_pagos: number;
  pontos_indicado: number;
  sem_pontos_motivo: string | null;
  motivo_recusa: string | null;
  criada_em: string;
  convertido_em: string | null;
  expira_em: string | null;
  venda_id: string | null;
}

export const STATUS_INDICACAO: Record<string, string> = {
  pendente: "Pendente",
  convertida: "Convertida",
  expirada: "Expirada",
  recusada: "Recusada",
};

export const ORIGEM_REGISTRO: Record<string, string> = {
  equipe: "Equipe",
  codigo: "Código",
  link: "Link",
};

/** Motivo sem pontos para a equipe. */
export const MOTIVO_SEM_PONTOS_EQUIPE: Record<string, string> = {
  anterior_ao_programa: "Anterior ao programa (carga de prospects antigos)",
  indicador_inativo: "Indicador sem plano vigente na conversão",
  teto_anual: "Indicador já tinha 10 indicações pagas no ano",
  ja_pago: "Pontos já pagos antes",
};

/** Motivo sem pontos em linguagem simples, para o aluno. */
export const MOTIVO_SEM_PONTOS_ALUNO: Record<string, string> = {
  anterior_ao_programa: "Sem pontos: indicação anterior ao programa",
  indicador_inativo: "Sem pontos: seu plano estava inativo",
  teto_anual: "Sem pontos: limite de 10 indicações no ano atingido",
  ja_pago: "Pontos já recebidos antes",
};

const ERROS: Record<string, string> = {
  auto_indicacao: "A pessoa não pode indicar a si mesma.",
  indicado_ja_ativo: "Este cadastro já tem plano vigente; a indicação não pode ser registrada.",
  indicado_ja_tem_indicador: "Este prospect já tem um indicador registrado.",
  indicador_equipe: "Pessoas da equipe não podem ser indicadoras.",
  indicado_equipe: "Pessoas da equipe não podem ser indicadas.",
  indicador_nao_encontrado: "Indicador não encontrado.",
  so_pendente: "Só é possível alterar indicações pendentes.",
  motivo_obrigatorio: "Informe o motivo.",
  sem_indicacao: "Indicação convertida não encontrada.",
  fora_do_prazo: "A reversão só é permitida até 30 dias após a conversão.",
  sem_permissao: "Você não tem permissão para esta ação.",
};

export function mensagemErroIndicacao(codigo?: string | null): string {
  return (codigo && ERROS[codigo]) || codigo || "Não foi possível registrar a indicação.";
}

export function isOrigemIndicacao(origem?: string | null): boolean {
  return (origem || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().startsWith("indicacao");
}

/**
 * Indicador é obrigatório em cadastros novos ou quando a origem passa a ser Indicação agora.
 * Em registros antigos que já estavam como Indicação, só avisamos.
 */
export function indicadorObrigatorio(origem: string | null | undefined, origemOriginal: string | null | undefined, novo: boolean): boolean {
  if (!isOrigemIndicacao(origem)) return false;
  return novo || !isOrigemIndicacao(origemOriginal);
}

async function rpcJson(nome: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(nome as any, args as any);
  if (error) throw new Error(mensagemErroIndicacao(error.message));
  const r = data as { ok?: boolean; erro?: string } | null;
  if (!r?.ok) throw new Error(mensagemErroIndicacao(r?.erro));
  return r;
}

export function registrarIndicacao(indicadoId: string, padrinhoId: string) {
  return rpcJson("fn_indicacao_registrar", { p_indicado_id: indicadoId, p_padrinho_id: padrinhoId, p_origem: "equipe" });
}

export function vincularIndicacaoAntiga(indicadoId: string, padrinhoId: string) {
  return rpcJson("fn_indicacao_vincular_antiga", { p_indicado_id: indicadoId, p_padrinho_id: padrinhoId });
}

export function recusarIndicacao(id: string, motivo: string) {
  return rpcJson("fn_indicacao_recusar", { p_id: id, p_motivo: motivo });
}

export function reverterIndicacao(id: string) {
  return rpcJson("fn_indicacao_reverter_admin", { p_id: id });
}

export function corrigirIndicador(id: string, padrinhoId: string) {
  return rpcJson("fn_indicacao_corrigir_indicador", { p_id: id, p_padrinho_id: padrinhoId });
}

export async function buscarIndicador(termo: string): Promise<IndicadorOpcao[]> {
  if (termo.trim().length < 3) return [];
  const { data, error } = await supabase.rpc("fn_indicacao_buscar_indicador" as any, { p_termo: termo.trim() } as any);
  if (error) throw error;
  return (data as IndicadorOpcao[]) || [];
}

export async function listarIndicacoes(f: { status?: string | null; padrinho?: string | null; indicado?: string | null; de?: string | null; ate?: string | null } = {}): Promise<IndicacaoLinha[]> {
  const { data, error } = await supabase.rpc("fn_indicacoes_lista" as any, {
    p_status: f.status || null, p_padrinho: f.padrinho || null, p_indicado: f.indicado || null,
    p_de: f.de || null, p_ate: f.ate || null,
  } as any);
  if (error) throw error;
  return (data as IndicacaoLinha[]) || [];
}

/** Salva a indicação do formulário quando há indicador escolhido e o cadastro ainda não tem indicação. */
export async function salvarIndicacaoDoFormulario(indicadoId: string, origem: string | null | undefined, indicador: IndicadorOpcao | null) {
  if (!isOrigemIndicacao(origem) || !indicador) return;
  const existentes = await listarIndicacoes({ indicado: indicadoId });
  if (existentes.length > 0) return;
  await registrarIndicacao(indicadoId, indicador.aluno_id);
}
