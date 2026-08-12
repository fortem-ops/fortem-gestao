import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";

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
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "status-tokenizacao", 30, 60);
    if (!ok) return json(429, { error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const tokenizationId = typeof body?.tokenization_id === "string" ? body.tokenization_id.trim() : "";
    if (!tokenizationId) return json(400, { error: "tokenization_id_obrigatorio" });

    const { data: tok, error } = await admin
      .from("rede_tokenizacoes")
      .select("status, cartao_salvo_id")
      .eq("tokenization_id", tokenizationId)
      .maybeSingle();

    if (error) throw error;
    if (!tok) return json(404, { error: "nao_encontrado" });

    // resposta mínima: nada do titular do cartão é exposto
    return json(200, { status: tok.status, cartao_salvo_id: tok.cartao_salvo_id ?? null });
  } catch (err) {
    console.error("corrida-status-tokenizacao error:", err);
    return json(500, { error: "erro_interno" });
  }
});
