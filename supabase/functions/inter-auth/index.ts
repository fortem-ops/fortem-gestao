// Diagnóstico admin-only: confirma que o token do Pix Automático é obtido. Nunca devolve o token.
import { corsHeaders, jsonResponse, getInterToken, admin, requireAdmin, CRED_PIX_AUTOMATICO } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;
    await getInterToken();
    const { data } = await admin()
      .from("inter_tokens")
      .select("expires_at, scope")
      .eq("credencial", CRED_PIX_AUTOMATICO)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return jsonResponse({ ok: true, credencial: CRED_PIX_AUTOMATICO, expires_at: data?.expires_at ?? null, scope: data?.scope ?? null });
  } catch (e) {
    console.error("inter-auth error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
