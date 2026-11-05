// Confere no servidor se o JWT pertence a um admin com perfil ativo.
// deno-lint-ignore no-explicit-any
export async function adminAtivo(sb: any, authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const { data: u, error } = await sb.auth.getUser(authHeader.slice(7));
  if (error || !u?.user) return false;
  const uid = u.user.id;
  const [{ data: role }, { data: perfil }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    sb.from("profiles").select("ativo").eq("user_id", uid).maybeSingle(),
  ]);
  return !!role && perfil?.ativo === true;
}
