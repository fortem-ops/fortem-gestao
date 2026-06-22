import { corsHeaders, jsonResponse, getInterToken, admin, requireAdminOrCoord } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;

    const token = await getInterToken();
    const { data } = await admin()
      .from("inter_tokens")
      .select("expires_at")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return jsonResponse({ access_token: token, expires_at: data?.expires_at ?? null });
  } catch (e) {
    console.error("inter-auth error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
