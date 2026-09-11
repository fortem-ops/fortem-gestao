import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/loja-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "validar-cupom", 20, 60);
    if (!ok) return json(429, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const codigo = String(body?.codigo ?? "").trim();
    const subtotal = Number(body?.subtotal ?? 0);
    if (!codigo || !Number.isFinite(subtotal) || subtotal <= 0) {
      return json(200, { ok: false, error: "cupom_invalido" });
    }

    const { data, error } = await admin.rpc("fn_loja_validar_cupom", {
      p_codigo: codigo,
      p_subtotal: subtotal,
    });
    if (error) {
      console.error("[loja-validar-cupom] rpc:", error.message);
      return json(200, { ok: false, error: "falha_validar_cupom" });
    }
    return json(200, data);
  } catch (error) {
    console.error("[loja-validar-cupom] erro:", error);
    return json(500, { ok: false, error: "erro_interno" });
  }
});