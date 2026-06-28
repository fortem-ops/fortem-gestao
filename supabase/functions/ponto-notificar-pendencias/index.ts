// Edge Function: ponto-notificar-pendencias
// Notifica diariamente profissionais com jornada aberta sem saída + coord/admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: exige service role key
  const auth = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
  if (!auth || auth !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hoje = new Date().toISOString().slice(0, 10);
    console.log(`[ponto-pendencias] Verificando jornadas de ${hoje}`);

    // a) Jornadas abertas hoje (entrada sem saída)
    const { data: jornadas, error: jErr } = await supabase
      .from("ponto_jornadas")
      .select("id, usuario_id, entrada")
      .eq("data", hoje)
      .not("entrada", "is", null)
      .is("saida", null);

    if (jErr) throw jErr;

    const pendentes = jornadas ?? [];
    console.log(`[ponto-pendencias] ${pendentes.length} jornada(s) pendente(s)`);

    let notificados = 0;
    for (const j of pendentes) {
      try {
        const { error } = await supabase.rpc("fn_notificar_criar_notificacao", {
          p_titulo: "Pendência de ponto — saída não registrada",
          p_descricao:
            "Você iniciou sua jornada hoje mas não registrou a saída. Acesse o módulo Ponto para regularizar.",
          p_categoria: "administrativo",
          p_prioridade: "alta",
          p_tipo: "simples",
          p_destinatarios: [j.usuario_id],
        });
        if (error) throw error;
        notificados++;
      } catch (e) {
        console.error(`[ponto-pendencias] Falha ao notificar ${j.usuario_id}:`, e);
      }
    }

    // c) Coord/admin
    let coordsAlertados = false;
    if (pendentes.length > 0) {
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["coordenador", "admin"]);
      if (rErr) throw rErr;

      const destinatarios = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (destinatarios.length > 0) {
        try {
          const { error } = await supabase.rpc("fn_notificar_criar_notificacao", {
            p_titulo: `Pendências de ponto na equipe — ${pendentes.length} registro(s)`,
            p_descricao: `Há ${pendentes.length} profissional(is) com jornada aberta hoje sem saída registrada. Acesse Relatório de Ponto para verificar.`,
            p_categoria: "administrativo",
            p_prioridade: "alta",
            p_tipo: "simples",
            p_destinatarios: destinatarios,
          });
          if (error) throw error;
          coordsAlertados = true;
          console.log(`[ponto-pendencias] ${destinatarios.length} coord/admin alertado(s)`);
        } catch (e) {
          console.error("[ponto-pendencias] Falha ao alertar coord/admin:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ notificados, coordsAlertados, total_pendentes: pendentes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    console.error("[ponto-pendencias] Erro:", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
