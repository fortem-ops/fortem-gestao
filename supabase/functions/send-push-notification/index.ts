import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY_RAW") ?? Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@fortem.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid VAPID keys: " + (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { aluno_id, title, body, url, icon, gatilho } = await req.json();

  if (!aluno_id || !title) {
    return new Response(JSON.stringify({ error: "aluno_id and title required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs, error: subsErr } = await supabase
    .from("portal_push_subscriptions")
    .select("*")
    .eq("aluno_id", aluno_id);

  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: "No subscriptions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = JSON.stringify({
    title,
    body: body ?? "",
    icon: icon ?? "/favicon.png",
    badge: "/favicon.png",
    url: url ?? "/portal",
    gatilho: gatilho ?? "manual",
    timestamp: Date.now(),
  });

  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400 }
      );
      sent++;
      await supabase.from("portal_push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (e: any) {
      const status = e?.statusCode;
      errors.push(`${status ?? "?"}: ${e?.body ?? e?.message ?? "unknown"}`);
      if (status === 404 || status === 410) {
        await supabase.from("portal_push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  await supabase.from("portal_push_log").insert({
    aluno_id,
    gatilho: gatilho ?? "manual",
    title,
    body: body ?? "",
    sucesso: sent > 0,
    erro_detalhe: errors.length > 0 ? errors.join("; ") : null,
  });

  return new Response(JSON.stringify({ ok: true, sent, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
