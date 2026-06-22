import { corsHeaders, jsonResponse, getInterToken, admin, requireAdminOrCoord } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdminOrCoord(req);
    if ("error" in auth) return auth.error;

    const clientId = Deno.env.get("INTER_CLIENT_ID") ?? "";
    console.log("[inter-auth] CLIENT_ID:", clientId.substring(0, 8) + "..." + clientId.slice(-4), "len=", clientId.length);
    const token = await getInterToken();
    console.log("[inter-auth] token prefix:", token.substring(0, 20), "len=", token.length);
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
