import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PIPEDRIVE_API_KEY = Deno.env.get("PIPEDRIVE_API_KEY");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAllowedRole(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims) return { error: "Unauthorized", status: 401 };
  const userId = claims.claims.sub as string;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const [a, c] = await Promise.all([
    admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    admin.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a.data && !c.data) return { error: "Forbidden", status: 403 };
  return { userId, admin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAllowedRole(req.headers.get("Authorization"));
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    if (!PIPEDRIVE_API_KEY) return json({ error: "PIPEDRIVE_API_KEY not configured" }, 500);

    const started = Date.now();
    const res = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": PIPEDRIVE_API_KEY,
      },
    });
    const elapsed = Date.now() - started;
    const data = await res.json().catch(() => ({}));
    return json({
      status: res.status,
      outcome: data?.outcome ?? (res.ok ? "verified" : "failed"),
      latency_ms: data?.latency_ms ?? elapsed,
      error: data?.error,
    }, res.ok ? 200 : 502);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
