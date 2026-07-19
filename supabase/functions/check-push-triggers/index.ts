import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendPush(supabaseUrl: string, serviceKey: string, payload: object) {
  await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);

  // 1) Plano vencendo em 30 dias
  const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
  const em30Str = em30.toISOString().slice(0, 10);
  const { data: planosVencendo } = await supabase
    .from("planos")
    .select("aluno_id, tipo, data_fim")
    .eq("ativo", true)
    .eq("data_fim", em30Str);

  for (const p of planosVencendo ?? []) {
    const { data: jaEnviou } = await supabase
      .from("portal_push_log")
      .select("id")
      .eq("aluno_id", p.aluno_id)
      .eq("gatilho", "plano_vencendo_30d")
      .gte("enviado_em", hojeStr)
      .limit(1);
    if (jaEnviou && jaEnviou.length > 0) continue;
    await sendPush(supabaseUrl, serviceKey, {
      aluno_id: p.aluno_id,
      title: "Renovação do plano se aproxima",
      body: `Seu plano ${p.tipo} vence em 30 dias. Fique de olho!`,
      url: "/portal/plano",
      gatilho: "plano_vencendo_30d",
    });
  }

  // 2) Reavaliação pendente (>= 4 meses)
  const meses4 = new Date(hoje); meses4.setMonth(meses4.getMonth() - 4);
  const meses4Str = meses4.toISOString().slice(0, 10);
  const { data: avals } = await supabase
    .from("avaliacoes")
    .select("aluno_id, data")
    .in("tipo", ["funcional_v2", "funcional"])
    .lt("data", meses4Str)
    .order("data", { ascending: false });

  const latestAval = new Map<string, string>();
  for (const av of avals ?? []) {
    if (!latestAval.has(av.aluno_id)) latestAval.set(av.aluno_id, av.data);
  }
  for (const [aluno_id] of latestAval) {
    const { data: jaEnviou } = await supabase
      .from("portal_push_log")
      .select("id")
      .eq("aluno_id", aluno_id)
      .eq("gatilho", "reavaliacao_pendente")
      .gte("enviado_em", hojeStr)
      .limit(1);
    if (jaEnviou && jaEnviou.length > 0) continue;
    await sendPush(supabaseUrl, serviceKey, {
      aluno_id,
      title: "Hora de reavaliar! 📊",
      body: "Já faz mais de 4 meses desde sua última avaliação funcional. Agende agora.",
      url: "/portal/avaliacoes",
      gatilho: "reavaliacao_pendente",
    });
  }

  // 3) Créditos baixos (<= 2)
  const { data: creditos } = await supabase
    .from("creditos_aluno" as any)
    .select("aluno_id, quantidade_inicial, quantidade_usada, atividade, ativo")
    .eq("ativo", true)
    .eq("atividade", "Treino");

  for (const c of (creditos as any[]) ?? []) {
    const saldo = (c.quantidade_inicial ?? 0) - (c.quantidade_usada ?? 0);
    if (saldo > 2 || saldo < 0) continue;
    const { data: jaEnviou } = await supabase
      .from("portal_push_log")
      .select("id")
      .eq("aluno_id", c.aluno_id)
      .eq("gatilho", "creditos_baixos")
      .gte("enviado_em", hojeStr)
      .limit(1);
    if (jaEnviou && jaEnviou.length > 0) continue;
    await sendPush(supabaseUrl, serviceKey, {
      aluno_id: c.aluno_id,
      title: "Créditos acabando ⚠️",
      body: `Você tem apenas ${saldo} crédito${saldo !== 1 ? "s" : ""} de treino restante${saldo !== 1 ? "s" : ""}`,
      url: "/portal/plano",
      gatilho: "creditos_baixos",
    });
  }

  // 4) Aniversário FORTEM
  const { data: planosAniv } = await supabase
    .from("planos")
    .select("aluno_id, data_inicio")
    .eq("ativo", true);

  for (const p of planosAniv ?? []) {
    if (!p.data_inicio) continue;
    const inicio = new Date(p.data_inicio + "T00:00:00");
    const anos = hoje.getFullYear() - inicio.getFullYear();
    if (anos <= 0) continue;
    if (inicio.getMonth() !== hoje.getMonth() || inicio.getDate() !== hoje.getDate()) continue;

    const { data: jaEnviou } = await supabase
      .from("portal_push_log")
      .select("id")
      .eq("aluno_id", p.aluno_id)
      .eq("gatilho", "aniversario_fortem")
      .gte("enviado_em", hojeStr)
      .limit(1);
    if (jaEnviou && jaEnviou.length > 0) continue;
    await sendPush(supabaseUrl, serviceKey, {
      aluno_id: p.aluno_id,
      title: `🎉 ${anos} ano${anos > 1 ? "s" : ""} na FORTEM!`,
      body: "Obrigado por fazer parte da nossa comunidade. Você é incrível!",
      url: "/portal",
      gatilho: "aniversario_fortem",
    });
  }

  return new Response(JSON.stringify({ ok: true, processado_em: hojeStr }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
