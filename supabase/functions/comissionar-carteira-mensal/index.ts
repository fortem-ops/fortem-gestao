import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // primeiro dia do mês anterior como data_referencia
    const now = new Date();
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    const { data, error } = await supabase.rpc("fn_processar_comissao_carteira", { _ref: ref });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, criadas: data, referencia: ref }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
