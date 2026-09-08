import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * web-push exige a chave privada VAPID como escalar bruto de 32 bytes (base64url).
 * A chave configurada pode estar em PKCS8 (gerada por generate-vapid-keys); neste caso
 * extraímos o escalar `d` via WebCrypto, sem trocar o par de chaves (assinaturas
 * existentes continuam válidas).
 */
async function normalizeVapidPrivateKey(privateKey: string, publicKey: string): Promise<string> {
  const bytes = b64urlToBytes(privateKey.trim());
  if (bytes.length === 32) return privateKey.trim();
  const key = await crypto.subtle.importKey(
    "pkcs8", bytes, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);
  if (!jwk.d) throw new Error("PKCS8 key without private scalar");
  if (jwk.x && jwk.y) {
    const derivedPub = new Uint8Array([4, ...b64urlToBytes(jwk.x), ...b64urlToBytes(jwk.y)]);
    const configuredPub = b64urlToBytes(publicKey.trim());
    const same = derivedPub.length === configuredPub.length && derivedPub.every((b, i) => b === configuredPub[i]);
    if (!same) console.warn("[send-push] VAPID_PUBLIC_KEY não corresponde à chave privada configurada");
  }
  return jwk.d;
}

let cachedPrivateKey: string | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKeyEnv = Deno.env.get("VAPID_PRIVATE_KEY_RAW") ?? Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@fortem.app";

  if (!vapidPublicKey || !vapidPrivateKeyEnv) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    cachedPrivateKey ??= await normalizeVapidPrivateKey(vapidPrivateKeyEnv, vapidPublicKey);
    webpush.setVapidDetails(vapidSubject, vapidPublicKey.trim(), cachedPrivateKey);
  } catch (e) {
    console.error("[send-push] Invalid VAPID keys:", (e as Error).message);
    return new Response(JSON.stringify({ error: "Invalid VAPID keys: " + (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payloadIn: Record<string, unknown>;
  try {
    payloadIn = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { aluno_id, title, body, url, icon, gatilho } = payloadIn as {
    aluno_id?: string; title?: string; body?: string; url?: string; icon?: string; gatilho?: string;
  };

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
