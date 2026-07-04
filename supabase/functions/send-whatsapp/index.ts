import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function upsertConversaAndSave(params: {
  telefone: string;
  conteudo: string;
  wamid?: string;
}) {
  const { telefone, conteudo, wamid } = params;
  const nowIso = new Date().toISOString();
  const { data: conv, error: convErr } = await admin
    .from('whatsapp_conversas')
    .upsert(
      { telefone, ultima_mensagem: conteudo, ultima_mensagem_at: nowIso },
      { onConflict: 'telefone' },
    )
    .select('id')
    .single();
  if (convErr) {
    console.error('[send-whatsapp] upsert conversa error', convErr);
    return;
  }
  const { error: msgErr } = await admin.from('whatsapp_mensagens').insert({
    conversa_id: conv.id,
    wamid,
    direcao: 'enviada',
    tipo: 'text',
    conteudo,
    status: 'sent',
  });
  if (msgErr) console.error('[send-whatsapp] insert mensagem error', msgErr);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authError } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp secrets não configurados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.to !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Payload inválido. Requer { to, ... }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const toClean = String(body.to).replace(/\D/g, '');
    const isText = body.type === 'text';

    let payload: Record<string, unknown>;
    if (isText) {
      const text: string = typeof body.text === 'string' ? body.text : body.text?.body ?? '';
      if (!text.trim()) {
        return new Response(
          JSON.stringify({ error: 'Texto vazio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      payload = {
        messaging_product: 'whatsapp',
        to: toClean,
        type: 'text',
        text: { body: text },
      };
    } else {
      if (typeof body.template_name !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Requer template_name ou type=text' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      payload = {
        messaging_product: 'whatsapp',
        to: toClean,
        type: 'template',
        template: {
          name: body.template_name,
          language: { code: body.language ?? 'pt_BR' },
          components: body.components ?? [],
        },
      };
    }

    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const metaResp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaJson = await metaResp.json().catch(() => ({}));

    if (!metaResp.ok) {
      console.error('[send-whatsapp] Meta error', metaResp.status, metaJson);
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar mensagem', status: metaResp.status, details: metaJson }),
        { status: metaResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (isText) {
      const wamid = (metaJson as any)?.messages?.[0]?.id;
      await upsertConversaAndSave({
        telefone: toClean,
        conteudo: (payload.text as any).body,
        wamid,
      });
    }

    return new Response(JSON.stringify({ ok: true, result: metaJson }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-whatsapp] erro inesperado', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
