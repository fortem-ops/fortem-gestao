import { supabase } from "@/integrations/supabase/client";

/** Filtro PostgREST: aluno da carteira = professor responsável OU consultor responsável. */
export function filtroCarteiraOr(userId: string): string {
  return `responsavel_id.eq.${userId},consultor_id.eq.${userId}`;
}

/** IDs dos alunos da carteira do usuário (responsável ou consultor). */
export async function fetchAlunosDaCarteira(userId: string): Promise<string[]> {
  const { data } = await supabase.from("alunos").select("id").or(filtroCarteiraOr(userId));
  return ((data || []) as { id: string }[]).map((a) => a.id);
}

/** Tarefas técnicas que não interessam a quem vê o aluno apenas como consultor. */
export const TIPOS_OCULTOS_CONSULTOR = [
  "atualizar_treino",
  "relatorio_tecnico_forca",
  "relatorio_tecnico_corrida",
] as const;

/**
 * Remove as tarefas técnicas (atualizar treino e relatórios técnicos) que apareceriam
 * só porque a pessoa é consultor do aluno. As tarefas em que ela é a responsável ficam.
 */
export function filtrarTarefasConsultor<
  T extends { tipo_auto?: string | null; responsavel_id?: string | null },
>(tarefas: T[], userId: string | null | undefined): T[] {
  if (!userId) return tarefas;
  return tarefas.filter(
    (t) =>
      t.responsavel_id === userId ||
      !TIPOS_OCULTOS_CONSULTOR.includes((t.tipo_auto || "") as (typeof TIPOS_OCULTOS_CONSULTOR)[number]),
  );
}
