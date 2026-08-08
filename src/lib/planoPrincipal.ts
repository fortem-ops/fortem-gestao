import { supabase } from "@/integrations/supabase/client";

/**
 * Atividade do plano "principal" do aluno (mensalidade de treinamento).
 * Planos paralelos (ex.: Corrida) NUNCA devem ser confundidos com este.
 */
export const ATIVIDADE_PRINCIPAL = "treinamento_funcional";

/**
 * Query canônica do plano principal ativo do aluno.
 *
 * Sempre use esta função em vez de montar a query inline — assim o filtro
 * `atividade = 'treinamento_funcional'` nunca é esquecido em código novo.
 *
 * Equivalente no banco: `public.fn_plano_principal_ativo(uuid)`.
 *
 * @param alunoId id do aluno
 * @param columns colunas a selecionar (default "*")
 */
export function queryPlanoPrincipalAtivo(alunoId: string, columns = "*") {
  return (supabase as any)
    .from("planos")
    .select(columns)
    .eq("aluno_id", alunoId)
    .eq("ativo", true)
    .eq("atividade", ATIVIDADE_PRINCIPAL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** Versão que já devolve apenas o registro (ou null), ignorando o envelope. */
export async function getPlanoPrincipalAtivo<T = any>(
  alunoId: string,
  columns = "*",
): Promise<T | null> {
  const { data } = await queryPlanoPrincipalAtivo(alunoId, columns);
  return (data as T) ?? null;
}
