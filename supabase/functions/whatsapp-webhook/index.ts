import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = 'fortem_webhook_2024';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function handleIncomingMessages(value: any) {
  const messages: any[] = value?.messages ?? [];
  if (!messages.length) return;

  const contacts: any[] = value?.contacts ?? [];
  const contactName = contacts[0]?.profile?.name ?? null;

  for (const msg of messages) {
    const telefone = String(msg.from ?? '').replace(/\D/g, '');
    if (!telefone) continue;

    const tipo = msg.type ?? 'text';
    let conteudo = '';
    if (tipo === 'text') conteudo = msg.text?.body ?? '';
    else if (tipo === 'button') conteudo = msg.button?.text ?? '';
    else if (tipo === 'interactive') {
      conteudo =
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        '[interativo]';
    } else conteudo = `[${tipo}]`;

    const nowIso = new Date(Number(msg.timestamp) * 1000 || Date.now()).toISOString();

    // Upsert conversation, increment nao_lidas
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_conversas')
      .select('id, nao_lidas, nome_contato')
      .eq('telefone', telefone)
      .maybeSingle();

    let conversaId: string;
    if (existing) {
      conversaId = existing.id;
      await supabaseAdmin
        .from('whatsapp_conversas')
        .update({
          ultima_mensagem: conteudo,
          ultima_mensagem_at: nowIso,
          nao_lidas: (existing.nao_lidas ?? 0) + 1,
          nome_contato: existing.nome_contato ?? contactName,
        })
        .eq('id', conversaId);
    } else {
      const { data: created, error: cErr } = await supabaseAdmin
        .from('whatsapp_conversas')
        .insert({
          telefone,
          nome_contato: contactName,
          ultima_mensagem: conteudo,
          ultima_mensagem_at: nowIso,
          nao_lidas: 1,
        })
        .select('id')
        .single();
      if (cErr || !created) {
        console.error('[whatsapp-webhook] create conversa error', cErr);
        continue;
      }
      conversaId = created.id;
    }

    const { error: mErr } = await supabaseAdmin.from('whatsapp_mensagens').insert({
      conversa_id: conversaId,
      wamid: msg.id ?? null,
      direcao: 'recebida',
      tipo,
      conteudo,
      status: 'received',
    });
    if (mErr) console.error('[whatsapp-webhook] insert mensagem error', mErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

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

      let type: string = 'unknown';
      try {
        const change = payload?.entry?.[0]?.changes?.[0];
        if (change?.value?.messages?.length) type = 'message';
        else if (change?.value?.statuses?.length) type = 'status';
        else if (change?.field) type = String(change.field);

        if (type === 'message') {
          await handleIncomingMessages(change.value);
        }
      } catch (e) {
        console.error('[whatsapp-webhook] parse error', e);
      }

      const { error } = await supabaseAdmin.from('whatsapp_events').insert({
        type,
        payload,
      });
      if (error) console.error('[whatsapp-webhook] insert event error', error);
    } catch (err) {
      console.error('[whatsapp-webhook] erro', err);
    }
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
