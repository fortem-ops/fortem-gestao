// Push do aluno. Só servidor/cron (chave de serviço ou segredo das rotinas) ou staff ativo podem chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { avaliarChamador } from "../_shared/chamador-push-srv.ts";
import { configurarVapid, webpush } from "../_shared/vapid.ts";
import { inscricaoInvalida } from "../_shared/push-equipe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { acesso } = await avaliarChamador(req, supabase);
  if (acesso === "negado") return json({ error: "Unauthorized" }, 401);

  let payloadIn: unknown;
  try { payloadIn = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!payloadIn || typeof payloadIn !== "object") return json({ error: "Invalid JSON body" }, 400);
  const { aluno_id, title, body, url, icon, gatilho, referencia } = payloadIn as {
    aluno_id?: string; title?: string; body?: string; url?: string; icon?: string; gatilho?: string; referencia?: string;
  };
  if (!aluno_id || !title) return json({ error: "aluno_id and title required" }, 400);
  if (referencia !== undefined && (!referencia.trim() || referencia.length > 300)) {
    return json({ error: "referencia inválida" }, 400);
  }

  // A referência é reservada antes de procurar inscrições: ativar push depois não recupera avisos antigos.
  let reservaId: string | null = null;
  if (referencia) {
    const { data, error } = await supabase.from("portal_push_log").insert({
      aluno_id,
      gatilho: gatilho ?? "manual",
      title,
      body: body ?? "",
      url: url ?? "/portal",
      referencia,
      sucesso: false,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") return json({ ok: true, sent: 0, duplicate: true });
      return json({ error: error.message }, 500);
    }
    const reserva = data as { id?: unknown };
    if (typeof reserva.id !== "string") return json({ error: "Falha ao reservar aviso" }, 500);
    reservaId = reserva.id;
  }

  const vapidErro = await configurarVapid();
  if (vapidErro) {
    if (reservaId) {
      await supabase.from("portal_push_log").update({ sucesso: false, erro_detalhe: vapidErro }).eq("id", reservaId);
    }
    return json({ error: vapidErro }, 500);
  }

  const { data: subs, error: subsErr } = await supabase.from("portal_push_subscriptions").select("*").eq("aluno_id", aluno_id);
  if (subsErr) {
    if (reservaId) {
      await supabase.from("portal_push_log").update({ sucesso: false, erro_detalhe: subsErr.message }).eq("id", reservaId);
    }
    return json({ error: subsErr.message }, 500);
  }
  if (!subs || subs.length === 0) {
    if (reservaId) {
      await supabase.from("portal_push_log").update({ sucesso: false, erro_detalhe: "sem_inscricao" }).eq("id", reservaId);
    }
    return json({ ok: true, sent: 0, message: "No subscriptions" });
  }

  const payload = JSON.stringify({
    app: "aluno", title, body: body ?? "", icon: icon ?? "/favicon.png", badge: "/favicon.png",
    url: url ?? "/portal", gatilho: gatilho ?? "manual", timestamp: Date.now(),
  });

  let sent = 0;
  const errors: string[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 86400 });
      sent++;
      await supabase.from("portal_push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (e) {
      const err = e as { statusCode?: number; body?: string; message?: string };
      errors.push(`${err.statusCode ?? "?"}: ${err.body ?? err.message ?? "unknown"}`);
      if (inscricaoInvalida(err.statusCode)) await supabase.from("portal_push_subscriptions").delete().eq("id", sub.id);
    }
  }

  const resultado = {
    sucesso: sent > 0,
    erro_detalhe: errors.length > 0 ? errors.join("; ") : null,
  };
  if (reservaId) {
    await supabase.from("portal_push_log").update(resultado).eq("id", reservaId);
  } else {
    await supabase.from("portal_push_log").insert({
      aluno_id, gatilho: gatilho ?? "manual", title, body: body ?? "", url: url ?? "/portal", ...resultado,
    });
  }
  return json({ ok: true, sent, errors });
});
