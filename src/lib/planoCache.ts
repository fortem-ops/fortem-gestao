import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalida todos os caches relacionados ao plano de um aluno.
 * Garante que ao editar em "Plano/Serviços" o resumo, status e demais
 * telas refletem imediatamente a nova contratação.
 */
export function invalidatePlanoCaches(qc: QueryClient, alunoId: string) {
  qc.invalidateQueries({ queryKey: ["plano_ativo", alunoId] });
  qc.invalidateQueries({ queryKey: ["plano_resumo", alunoId] });
  qc.invalidateQueries({ queryKey: ["aluno_display_status", alunoId] });
  qc.invalidateQueries({ queryKey: ["aluno_licencas_summary", alunoId] });
  qc.invalidateQueries({ queryKey: ["creditos_resumo", alunoId] });
  qc.invalidateQueries({ queryKey: ["creditos_aluno_lista", alunoId] });
  qc.invalidateQueries({ queryKey: ["alunos_with_plans"] });
  qc.invalidateQueries({ queryKey: ["aluno", alunoId] });
}
