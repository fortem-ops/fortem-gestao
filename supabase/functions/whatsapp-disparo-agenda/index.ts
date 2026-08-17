// whatsapp-disparo-agenda — redeploy trigger 2026-07-09 (normalize phone)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizarTelefone, resolveTemplate } from '../_shared/whatsapp.ts';
import { buildAgendaContext, buildTemplatePayload } from '../_shared/agenda-template.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function alreadySent(agendaId: string, configId: string): Promise<boolean> {
  const { data } = await admin
    .from('whatsapp_disparos_log')
    .select('id')
    .eq('agenda_id', agendaId)
    .eq('config_id', configId)
    .in('status', ['enviado', 'bloqueado_teste'])
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function callSendWhatsApp(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; details?: unknown }> {
  try {
    const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'x-supabase-service-role': 'true',
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || (json && (json as any).error)) {
      return {
        ok: false,
        error: (json as any)?.error ?? `HTTP ${resp.status}`,
        details: (json as any)?.details ?? json,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendWhatsAppText(to: string, text: string) {
  return callSendWhatsApp({ to, type: 'text', text });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const evento: string = body?.evento;
    const agendaId: string = body?.agenda_id;

    if (!evento || !agendaId) {
      return new Response(JSON.stringify({ error: 'Requer { evento, agenda_id }' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ctx = await buildAgendaContext(admin, agendaId, body?.agenda_snapshot ?? null);
    if (!ctx) {
      return new Response(JSON.stringify({ error: 'Agenda não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: configs } = await admin
      .from('whatsapp_disparos_config')
      .select('*')
      .eq('gatilho', evento)
      .eq('ativo', true);

    const results: any[] = [];

    for (const cfg of (configs ?? []) as any[]) {
      if (cfg.atividades && Array.isArray(cfg.atividades) && cfg.atividades.length > 0) {
        if (!cfg.atividades.includes(ctx.agenda.atividade)) continue;
      }

      if (await alreadySent(agendaId, cfg.id)) {
        results.push({ config: cfg.nome, skipped: 'ja_enviado' });
        continue;
      }

      const destinoTelefone = normalizarTelefone(
        cfg.destinatario === 'profissional' ? ctx.profTelefone : ctx.alunoTelefone,
      );
      const destinoNome = cfg.destinatario === 'profissional' ? ctx.profissional?.full_name : ctx.aluno?.nome;

      const mensagem = resolveTemplate(cfg.template_texto, ctx.vars);

      // Modo teste bloqueia envio para alunos
      if (cfg.destinatario === 'aluno' && cfg.modo_teste) {
        await admin.from('whatsapp_disparos_log').insert({
          config_id: cfg.id,
          agenda_id: agendaId,
          aluno_id: ctx.agenda.aluno_id ?? null,
          destinatario_telefone: destinoTelefone,
          destinatario_nome: destinoNome,
          mensagem_enviada: mensagem,
          status: 'bloqueado_teste',
        });
        results.push({ config: cfg.nome, status: 'bloqueado_teste' });
        continue;
      }

      if (!destinoTelefone) {
        await admin.from('whatsapp_disparos_log').insert({
          config_id: cfg.id,
          agenda_id: agendaId,
          aluno_id: ctx.agenda.aluno_id ?? null,
          destinatario_telefone: null,
          destinatario_nome: destinoNome,
          mensagem_enviada: mensagem,
          status: 'erro',
          erro_detalhe: 'Sem telefone cadastrado',
        });
        results.push({ config: cfg.nome, status: 'erro', reason: 'sem_telefone' });
        continue;
      }

      const templatePayload = buildTemplatePayload(cfg.nome, cfg.gatilho, ctx.vars, destinoTelefone);

      const send = templatePayload
        ? await callSendWhatsApp(templatePayload)
        : await sendWhatsAppText(destinoTelefone, mensagem);

      await admin.from('whatsapp_disparos_log').insert({
        config_id: cfg.id,
        agenda_id: agendaId,
        aluno_id: ctx.agenda.aluno_id ?? null,
        destinatario_telefone: destinoTelefone,
        destinatario_nome: destinoNome,
        mensagem_enviada: mensagem,
        status: send.ok ? 'enviado' : 'erro',
        erro_detalhe: send.ok ? null : JSON.stringify({ error: send.error, details: send.details }),
      });

      // Após confirmar send.ok === true, salvar no chat
      if (send.ok) {
        // Upsert conversa
        let conversaId: string | null = null;
        const nowIso = new Date().toISOString();

        const { data: upserted } = await admin
          .from('whatsapp_conversas')
          .upsert(
            {
              telefone: destinoTelefone,
              nome_contato: destinoNome,
              ultima_mensagem: mensagem.substring(0, 100),
              ultima_mensagem_at: nowIso,
            },
            { onConflict: 'telefone', ignoreDuplicates: false },
          )
          .select('id')
          .single();

        if (upserted?.id) {
          conversaId = upserted.id;
        } else {
          const { data: existing } = await admin
            .from('whatsapp_conversas')
            .select('id')
            .eq('telefone', destinoTelefone)
            .single();
          conversaId = existing?.id ?? null;
        }

        if (conversaId) {
          await admin.from('whatsapp_mensagens').insert({
            conversa_id: conversaId,
            direcao: 'enviada',
            tipo: 'text',
            conteudo: mensagem,
            status: 'sent',
            enviado_por: null, // disparo automático, sem funcionário específico
          });
        }
      }

      // Enviar cópia para o consultor se existir
      const consultorUserId = (ctx.agenda as any).consultor_id;
      if (send.ok && consultorUserId && cfg.destinatario === 'profissional') {
        const { data: consultorProfile } = await admin
          .from('profiles')
          .select('phone, full_name')
          .eq('user_id', consultorUserId)
          .maybeSingle();

        const consultorTel = normalizarTelefone((consultorProfile as any)?.phone);

        if (consultorTel && consultorTel !== destinoTelefone) {
          const consultorPayload = templatePayload
            ? { ...templatePayload, to: consultorTel }
            : null;

          const sendConsultor = consultorPayload
            ? await callSendWhatsApp(consultorPayload)
            : await sendWhatsAppText(consultorTel, mensagem);

          await admin.from('whatsapp_disparos_log').insert({
            config_id: cfg.id,
            agenda_id: agendaId,
            aluno_id: ctx.agenda.aluno_id ?? null,
            destinatario_telefone: consultorTel,
            destinatario_nome: (consultorProfile as any)?.full_name ?? 'Consultor',
            mensagem_enviada: mensagem,
            status: sendConsultor.ok ? 'enviado' : 'erro',
            erro_detalhe: sendConsultor.ok ? null : JSON.stringify({ error: sendConsultor.error }),
          });

          if (sendConsultor.ok) {
            const nowIso = new Date().toISOString();
            const { data: conv } = await admin
              .from('whatsapp_conversas')
              .upsert(
                {
                  telefone: consultorTel,
                  nome_contato: (consultorProfile as any)?.full_name ?? 'Consultor',
                  ultima_mensagem: mensagem.substring(0, 100),
                  ultima_mensagem_at: nowIso,
                },
                { onConflict: 'telefone', ignoreDuplicates: false },
              )
              .select('id')
              .single();

            if (conv?.id) {
              await admin.from('whatsapp_mensagens').insert({
                conversa_id: conv.id,
                direcao: 'enviada',
                tipo: 'text',
                conteudo: mensagem,
                status: 'sent',
                enviado_por: null,
              });
            }
          }
        }
      }

      results.push({ config: cfg.nome, status: send.ok ? 'enviado' : 'erro', error: send.error });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[whatsapp-disparo-agenda]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
