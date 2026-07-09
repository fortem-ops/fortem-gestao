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
  enviado_por?: string | null;
}) {
  const { telefone, conteudo, wamid, enviado_por } = params;
  const nowIso = new Date().toISOString();

  let conversaId: string | null = null;

  const { data: upserted, error: upsertErr } = await admin
    .from('whatsapp_conversas')
    .upsert(
      { telefone, ultima_mensagem: conteudo, ultima_mensagem_at: nowIso },
      { onConflict: 'telefone', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (upsertErr || !upserted) {
    if (upsertErr) console.error('[send-whatsapp] upsert conversa error', upsertErr);
    const { data: existing } = await admin
      .from('whatsapp_conversas')
      .select('id')
      .eq('telefone', telefone)
      .single();
    conversaId = existing?.id ?? null;
  } else {
    conversaId = upserted.id;
  }

  if (!conversaId) {
    console.error('[send-whatsapp] não foi possível obter conversa id para', telefone);
    return;
  }

  // Valida enviado_por contra profiles para evitar violação de FK
  let enviadoPorValido: string | null = null;
  if (enviado_por) {
    const { data: prof } = await admin
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', enviado_por)
      .maybeSingle();
    if (prof) enviadoPorValido = enviado_por;
    else console.warn('[send-whatsapp] enviado_por sem profile correspondente:', enviado_por);
  }

  const { error: msgErr } = await admin.from('whatsapp_mensagens').insert({
    conversa_id: conversaId,
    wamid: wamid ?? null,
    direcao: 'enviada',
    tipo: 'text',
    conteudo,
    status: 'sent',
    enviado_por: enviadoPorValido,
  });
  if (msgErr) console.error('[send-whatsapp] insert mensagem error', msgErr);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceRoleHeader = req.headers.get('x-supabase-service-role');
    const isInternal = serviceRoleHeader === 'true';

    if (!isInternal) {
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
        enviado_por: typeof body.enviado_por === 'string' ? body.enviado_por : null,
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
