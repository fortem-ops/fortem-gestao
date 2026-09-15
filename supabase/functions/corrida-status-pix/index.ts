// Polling público do status de uma cobrança Pix do checkout /corrida.
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
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "status-pix", 120, 60);
    if (!ok) return json(429, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const txid = String(body?.txid ?? "").trim();
    if (!txid) return json(400, { ok: false, error: "txid_obrigatorio" });

    const { data: cob } = await admin
      .from("pix_cobrancas")
      .select("status, corrida_venda_id")
      .eq("txid", txid)
      .maybeSingle();

    if (!cob) return json(404, { ok: false, error: "cobranca_nao_encontrada" });

    return json(200, { ok: true, status: cob.status, venda_id: cob.corrida_venda_id });
  } catch (err) {
    console.error("corrida-status-pix error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
