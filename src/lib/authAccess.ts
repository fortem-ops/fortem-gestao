import { supabase } from "@/integrations/supabase/client";

export const STAFF_ROLES = [
  "admin",
  "coordenador",
  "professor",
  "nutricionista",
  "fisioterapeuta",
] as const;

export async function userHasStaffAccess(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...STAFF_ROLES]);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Tela de Usuários: mostra equipe e quem não tem papel; quem é só aluno não aparece. */
export function usuarioApareceNaEquipe(roles: readonly string[]): boolean {
  if (roles.length === 0) return true;
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}
