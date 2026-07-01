import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = 'fortem_webhook_2024';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Verificação do webhook (Meta chama via GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const payload = await req.json().catch(() => ({}));

      // Detectar o tipo de evento (mensagem, status, etc)
      let type: string = 'unknown';
      try {
        const change = payload?.entry?.[0]?.changes?.[0];
        if (change?.value?.messages?.length) type = 'message';
        else if (change?.value?.statuses?.length) type = 'status';
        else if (change?.field) type = String(change.field);
      } catch {
        // noop
      }

      const { error } = await supabaseAdmin.from('whatsapp_events').insert({
        type,
        payload,
      });
      if (error) console.error('[whatsapp-webhook] insert error', error);
    } catch (err) {
      console.error('[whatsapp-webhook] erro', err);
    }
    // Meta exige sempre 200
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
