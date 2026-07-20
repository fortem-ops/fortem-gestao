import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: configs } = await supabase.from("clube_config").select("chave, valor");
    const cfg = Object.fromEntries((configs || []).map((c: any) => [c.chave, c.valor]));

    const lat = cfg.clima_latitude || "-30.0331";
    const lon = cfg.clima_longitude || "-51.2300";
    const tempFrioMax = parseFloat(cfg.clima_temp_frio_max || "15");
    const tempCalorMin = parseFloat(cfg.clima_temp_calor_min || "33");
    const chuvaMin = parseFloat(cfg.clima_chuva_min_mm || "5");
    const multiplicador = parseFloat(cfg.clima_multiplicador || "1.5");

    const hoje = new Date().toISOString().slice(0, 10);

    const { data: cacheExistente } = await supabase
      .from("clube_clima_cache")
      .select("*")
      .eq("data", hoje)
      .maybeSingle();

    if (cacheExistente) {
      return new Response(JSON.stringify({ ok: true, cached: true, ...cacheExistente }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FSao_Paulo&forecast_days=1`;
    const resp = await fetch(url);
    const data = await resp.json();

    const tempMax = data.daily?.temperature_2m_max?.[0] ?? null;
    const tempMin = data.daily?.temperature_2m_min?.[0] ?? null;
    const precipitacao = data.daily?.precipitation_sum?.[0] ?? 0;

    let multAtivo = false;
    let motivo: string | null = null;

    if (tempMin !== null && tempMin <= tempFrioMax) {
      multAtivo = true;
      motivo = `Frio intenso (${tempMin}°C)`;
    } else if (tempMax !== null && tempMax >= tempCalorMin) {
      multAtivo = true;
      motivo = `Calor intenso (${tempMax}°C)`;
    } else if (precipitacao >= chuvaMin) {
      multAtivo = true;
      motivo = `Chuva (${precipitacao}mm)`;
    }

    await supabase.from("clube_clima_cache").upsert({
      data: hoje,
      temperatura_max: tempMax,
      temperatura_min: tempMin,
      precipitacao_mm: precipitacao,
      multiplicador_ativo: multAtivo,
      motivo,
      consultado_em: new Date().toISOString(),
    }, { onConflict: "data" });

    return new Response(
      JSON.stringify({
        ok: true,
        data: hoje,
        tempMax,
        tempMin,
        precipitacao,
        multiplicador_ativo: multAtivo,
        motivo,
        fator: multAtivo ? multiplicador : 1.0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
