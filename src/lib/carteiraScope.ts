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
