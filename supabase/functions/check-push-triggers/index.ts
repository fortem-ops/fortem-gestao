import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dataBrasilia, textoAvisoPortal, type AvisoPortal } from "../_shared/portal-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResultadoPush {
  sent?: number;
  duplicate?: boolean;
  error?: string;
}

async function sendPush(
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): Promise<ResultadoPush> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const erro = (await res.text()).slice(0, 300);
      console.error(`[check-push] send-push-notification -> ${res.status}: ${erro}`);
      return { error: erro };
    }
    return await res.json() as ResultadoPush;
  } catch (e) {
    console.error("[check-push] falha ao chamar send-push-notification:", (e as Error).message);
    return { error: (e as Error).message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    return await processar();
  } catch (e) {
    console.error("[check-push] erro inesperado:", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processar(): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const hoje = dataBrasilia();

  const { data, error } = await supabase.rpc("fn_portal_push_avisos", { p_hoje: hoje });
  if (error) throw new Error(error.message);
  const avisos = (data ?? []) as AvisoPortal[];

  let enviados = 0;
  let duplicados = 0;
  let semInscricao = 0;
  let falhas = 0;

  for (const aviso of avisos) {
    const texto = textoAvisoPortal(aviso);
    const resultado = await sendPush(supabaseUrl, serviceKey, {
      aluno_id: aviso.aluno_id,
      title: texto.title,
      body: texto.body,
      url: aviso.url,
      gatilho: aviso.gatilho,
      referencia: aviso.referencia,
    });
    if (resultado.error) falhas += 1;
    else if (resultado.duplicate) duplicados += 1;
    else if ((resultado.sent ?? 0) > 0) enviados += 1;
    else semInscricao += 1;
  }

  return new Response(JSON.stringify({
    ok: true,
    processado_em: hoje,
    encontrados: avisos.length,
    enviados,
    duplicados,
    sem_inscricao: semInscricao,
    falhas,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
