// Exclusão segura de usuário: checa vínculos antes de apagar qualquer coisa.
export const COLUNAS_VINCULO: ReadonlyArray<readonly [string, string]> = [
  ["alunos", "user_id"], ["alunos", "responsavel_id"],
  ["agenda_servicos", "profissional_id"], ["agenda_servicos", "consultor_id"],
  ["tarefas", "responsavel_id"], ["tarefas", "criado_por_id"],
  ["avaliacoes", "avaliador_id"], ["treinos", "autor_id"], ["historico_profissional", "autor_id"],
  ["treino_horarios_fixos", "created_by"], ["treino_slots", "instrutor_id"], ["treino_slots", "created_by"],
  ["treino_agendamentos", "created_by"], ["contratos", "criado_por"], ["cobrancas", "registrado_por"],
  ["links_pagamento", "criado_por"], ["links_cartao", "criado_por"], ["pagamentos_rede", "created_by"],
  ["uploads", "autor_id"], ["contrato_templates", "criado_por"], ["regulamento_interno_versoes", "criado_por"],
  ["knowledge_articles", "created_by"], ["knowledge_articles", "updated_by"], ["clube_config", "updated_by"],
  ["clube_historico", "created_by"], ["clube_resgates", "aprovado_por"], ["clube_desafios", "created_by"],
  ["avaliacoes_comparativos_salvos", "criado_por"], ["sistema_config", "updated_by"],
  ["estoque_movimentos", "created_by"], ["facial_consentimentos", "aceito_por"],
  ["ponto_politica_retencao", "criado_por"],
];

export interface Vinculo { tabela: string; coluna: string; total: number }

export interface ExclusaoDeps {
  contarVinculos: () => Promise<Vinculo[]>;
  deleteUser: () => Promise<string | null>;
  limparRestos: () => Promise<void>;
  auditar: () => Promise<void>;
}

export type ResultadoExclusao =
  | { ok: true }
  | { ok: false; status: 400 | 409; erro: string; vinculos?: Vinculo[] };

/** Ordem: vínculos → deleteUser → limpeza → auditoria. Nada é apagado antes do deleteUser dar certo. */
export async function excluirUsuarioSeguro(callerId: string, targetId: string, deps: ExclusaoDeps): Promise<ResultadoExclusao> {
  if (callerId === targetId) return { ok: false, status: 400, erro: "Não é permitido excluir o próprio usuário" };
  const vinculos = (await deps.contarVinculos()).filter((v) => v.total > 0);
  if (vinculos.length > 0) {
    const lista = vinculos.map((v) => `${v.tabela} (${v.total})`).join(", ");
    return { ok: false, status: 409, erro: `Usuário tem vínculos: ${lista}. Transfira-os ou desative o usuário.`, vinculos };
  }
  const falha = await deps.deleteUser();
  if (falha) return { ok: false, status: 400, erro: falha };
  await deps.limparRestos();
  await deps.auditar();
  return { ok: true };
}
