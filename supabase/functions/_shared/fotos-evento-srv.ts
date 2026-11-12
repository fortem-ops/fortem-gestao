// Utilitários de servidor das fotos de eventos (IP com hash, papéis da equipe).
import { createClient } from "npm:@supabase/supabase-js@2";

export const BUCKET = "fotos-eventos";

export async function ipHash(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "sem-ip";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("fortem-fotos:" + ip));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type Papel = { userId: string; gerir: boolean; moderar: boolean };
/** Confere o usuário logado e os papéis: gerir = admin/coordenador; moderar = + professor. */
export async function papelEquipe(req: Request): Promise<Papel | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await anon.auth.getClaims(auth.slice(7));
  if (error || !data?.claims?.sub) return null;
  const userId = String(data.claims.sub);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const [{ data: gerir }, { data: moderar }] = await Promise.all([
    sb.rpc("fn_fotos_pode_gerir", { _uid: userId }), sb.rpc("fn_fotos_pode_moderar", { _uid: userId }),
  ]);
  return { userId, gerir: gerir === true, moderar: moderar === true };
}
