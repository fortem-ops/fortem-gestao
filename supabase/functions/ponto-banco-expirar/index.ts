// Edge Function: ponto-banco-expirar
// Expira saldo positivo do banco de horas acumulado antes do período de validade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYS_USER = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    // Configuração global
    const { data: cfg, error: cfgErr } = await supabase
      .from("ponto_configuracoes")
      .select("banco_horas_validade_meses")
      .is("usuario_id", null)
      .maybeSingle();
    if (cfgErr) throw cfgErr;

    const meses = (cfg as any)?.banco_horas_validade_meses as number | null;
    if (!meses || meses <= 0) {
      return new Response(
        JSON.stringify({ ignorado: true, motivo: "sem política de expiração configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Data de corte: hoje - meses
    const hoje = new Date();
    const corte = new Date(hoje.getFullYear(), hoje.getMonth() - meses, hoje.getDate());
    const dataCorte = corte.toISOString().slice(0, 10);
    const hojeIso = hoje.toISOString().slice(0, 10);

    console.log(`[ponto-banco-expirar] meses=${meses} corte=${dataCorte}`);

    // Profissionais (professor/admin)
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["professor", "admin"]);
    if (rErr) throw rErr;

    const usuarios = Array.from(new Set((roles ?? []).map((r: any) => r.user_id as string)));
    let expirados = 0;
    let totalMin = 0;

    for (const uid of usuarios) {
      const { data: lanc, error: lErr } = await supabase
        .from("ponto_banco_horas")
        .select("minutos")
        .eq("usuario_id", uid)
        .lt("data", dataCorte);
      if (lErr) {
        console.error(`[ponto-banco-expirar] erro ler ${uid}:`, lErr);
        continue;
      }
      const saldoAntes = (lanc ?? []).reduce((s: number, l: any) => s + Number(l.minutos ?? 0), 0);
      if (saldoAntes <= 0) continue;

      const { error: insErr } = await supabase.from("ponto_banco_horas").insert({
        usuario_id: uid,
        data: hojeIso,
        minutos: -saldoAntes,
        tipo: "expiracao",
        motivo: `Expiração automática — saldo acumulado antes de ${dataCorte}`,
        registrado_por: SYS_USER,
      });
      if (insErr) {
        console.error(`[ponto-banco-expirar] erro inserir ${uid}:`, insErr);
        continue;
      }
      console.log(`[ponto-banco-expirar] ${uid}: expirou ${saldoAntes}min`);
      expirados++;
      totalMin += saldoAntes;
    }

    return new Response(
      JSON.stringify({ expirados, total_minutos_expirados: totalMin, data_corte: dataCorte }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    console.error("[ponto-banco-expirar] Erro:", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
