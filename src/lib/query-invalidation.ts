import type { QueryClient } from "@tanstack/react-query";

/**
 * Helpers declarativos para invalidação de cache do react-query.
 *
 * Sempre que uma mutação afeta um domínio, chame o helper correspondente
 * em vez de espalhar `queryClient.invalidateQueries` com strings literais.
 * Isso evita "esquecer" de invalidar uma key relacionada quando o schema cresce.
 */

export const queryKeys = {
  alunos: ["alunos"] as const,
  alunosWithPlans: ["alunos_with_plans"] as const,
  alunoById: (id: string) => ["aluno", id] as const,
  pipeline: ["pipeline"] as const,
  pipelineMovements: (alunoId?: string) =>
    alunoId ? (["pipeline_movements", alunoId] as const) : (["pipeline_movements"] as const),
  agenda: ["agenda_servicos"] as const,
  notificacoes: ["notificacoes"] as const,
  creditos: (alunoId?: string) =>
    alunoId ? (["creditos_aluno", alunoId] as const) : (["creditos_aluno"] as const),
  planos: (alunoId?: string) =>
    alunoId ? (["planos", alunoId] as const) : (["planos"] as const),
  dashboard: ["dashboard-data"] as const,
  lastFuncionalBatch: ["last_funcional_batch"] as const,
  lastFuncionalAluno: (id: string) => ["last_funcional_aluno", id] as const,
};

export function invalidateAvaliacaoFuncional(qc: QueryClient, alunoId?: string) {
  // Prefix match cobre ["last_funcional_batch", alunoIds] usado em StudentList.
  qc.invalidateQueries({ queryKey: queryKeys.lastFuncionalBatch });
  qc.invalidateQueries({ queryKey: ["alunos_with_last_funcional"] });
  qc.invalidateQueries({ queryKey: ["lembrete-avaliacoes-pendentes"] });
  if (alunoId) {
    qc.invalidateQueries({ queryKey: queryKeys.lastFuncionalAluno(alunoId) });
    qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
    qc.invalidateQueries({ queryKey: ["historico-timeline", alunoId] });
  }
}

export function invalidateAluno(qc: QueryClient, alunoId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.alunos });
  qc.invalidateQueries({ queryKey: queryKeys.alunosWithPlans });
  if (alunoId) qc.invalidateQueries({ queryKey: queryKeys.alunoById(alunoId) });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function invalidatePipeline(qc: QueryClient, alunoId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.pipeline });
  qc.invalidateQueries({ queryKey: queryKeys.pipelineMovements(alunoId) });
  qc.invalidateQueries({ queryKey: queryKeys.alunosWithPlans });
  if (alunoId) qc.invalidateQueries({ queryKey: queryKeys.alunoById(alunoId) });
}

export function invalidateAgenda(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.agenda });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function invalidatePlanoECreditos(qc: QueryClient, alunoId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.planos(alunoId) });
  qc.invalidateQueries({ queryKey: queryKeys.creditos(alunoId) });
  qc.invalidateQueries({ queryKey: queryKeys.alunosWithPlans });
  if (alunoId) qc.invalidateQueries({ queryKey: queryKeys.alunoById(alunoId) });
}

export function invalidateNotificacoes(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.notificacoes });
}
