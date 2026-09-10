import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/loja-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "status-pedido", 120, 60);
    if (!ok) return json(200, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id ?? "").trim();
    if (!pedidoId) return json(200, { ok: false, error: "pedido_nao_encontrado" });

    const { data: pedido } = await admin
      .from("pedidos")
      .select("status")
      .eq("id", pedidoId)
      .maybeSingle();

    if (!pedido) return json(200, { ok: false, error: "pedido_nao_encontrado" });

    return json(200, { ok: true, status: pedido.status });
  } catch (err) {
    console.error("loja-status-pedido error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
