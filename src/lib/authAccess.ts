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