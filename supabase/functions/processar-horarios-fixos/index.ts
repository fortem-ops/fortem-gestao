import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase.rpc("fn_processar_horarios_fixos");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = data as any;
  if (result?.notificacoes?.length > 0) {
    for (const notif of result.notificacoes) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            aluno_id: notif.aluno_id,
            title: "Horário fixo indisponível esta semana",
            body: `Seu horário fixo de ${String(notif.horario).slice(0, 5)} não pôde ser reservado — turma cheia. Agende avulso ou aguarde a próxima semana.`,
            url: "/portal/agenda",
            gatilho: "horario_fixo_sem_vaga",
          }),
        });
      } catch (_) {
        // ignora falha de push individual
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
