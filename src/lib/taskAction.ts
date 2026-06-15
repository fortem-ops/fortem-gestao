export interface TaskActionable {
  tipo_auto?: string | null;
  aluno_id?: string | null;
}

/**
 * Returns the route to perform the action described by a task,
 * or null if there's no specific destination.
 */
export function getTaskActionTarget(task: TaskActionable): string | null {
  const { tipo_auto, aluno_id } = task;

  if (tipo_auto === "gravar_video") return null; // tem upload inline
  if (!aluno_id) return null;

  switch (tipo_auto) {
    case "atualizar_treino":
      return `/alunos/${aluno_id}?tab=treinos`;
    case "reavaliacao_funcional":
      return `/alunos/${aluno_id}?tab=avaliacoes`;
    case "pipeline_novo_lead":
    case "pipeline_avaliacao_agendada":
    case "pipeline_proposta":
    case "pipeline_risco_evasao":
      return `/alunos/${aluno_id}?tab=pipeline`;
    default:
      return `/alunos/${aluno_id}?tab=tarefas`;
  }
}
