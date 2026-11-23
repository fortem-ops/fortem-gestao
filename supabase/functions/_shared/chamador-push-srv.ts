import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decidirChamador, type Acesso, type Chamador } from "./chamador-push.ts";

export async function avaliarChamador(req: Request, sup: SupabaseClient): Promise<{ acesso: Acesso; userId: string | null }> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const c: Chamador = { chaveServico: !!token && token === servico, segredoRotina: false, usuario: null };

  const sec = req.headers.get("x-webhook-secret");
  if (sec) {
    const { data } = await sup.rpc("get_webhook_secret");
    c.segredoRotina = typeof data === "string" && data.length > 0 && data === sec;
  }
  let userId: string | null = null;
  if (!c.chaveServico && !c.segredoRotina && token) {
    const { data: u } = await sup.auth.getUser(token);
    if (u?.user) {
      userId = u.user.id;
      const [{ data: staff }, { data: perfil }] = await Promise.all([
        sup.rpc("is_staff", { _user_id: userId }),
        sup.from("profiles").select("ativo").eq("user_id", userId).maybeSingle(),
      ]);
      c.usuario = { staff: staff === true, ativo: (perfil as { ativo?: boolean } | null)?.ativo === true };
    }
  }
  return { acesso: decidirChamador(c), userId };
}
