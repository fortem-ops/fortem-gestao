import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Só staff/admin autenticado pode disparar manualmente.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userData.user.id });
    const { data: isCoord } = await admin.rpc("is_coordinator_or_admin", { _user_id: userData.user.id });
    if (!isAdmin && !isCoord) return json({ error: "Sem permissão" }, 403);

    const { data, error } = await admin.rpc("fn_auditoria_fiscal_pagamentos");
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, resultado: data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
