import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizarTelefone } from '../_shared/whatsapp.ts';
import { buildAgendaContext, buildTemplatePayload, sanitizeTextParam } from '../_shared/agenda-template.ts';

const CONFIG_ID = 'b41e481e-d101-4a10-94b9-2e26a65a4823';
const TZ = 'America/Sao_Paulo';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Mapear atividade → nome de config que buildTemplatePayload espera
const ATIVIDADE_CONFIG: Record<string, string> = {
  'Treino Experimental':           'Treino Experimental → Profissional',
  'Avaliação Funcional':           'Avaliação Funcional → Profissional',
  'Reabilitação':                  'Reabilitação → Profissional',
  'Recovery (Bota de Compressão)': 'Reabilitação → Profissional',
  'Nutrição':                      'Nutrição → Profissional',
  'Avaliação Física':              'Nutrição → Profissional',
};

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
    if (!resp.ok || (json as any)?.error) {
      return { ok: false, error: (json as any)?.error ?? `HTTP ${resp.status}`, details: json };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${serviceKey}`) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }

  try {
    // Data de amanhã em America/Sao_Paulo
    const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
    const [y, m, d] = hojeISO.split('-').map(Number);
    const amanhaDate = new Date(Date.UTC(y, m - 1, d + 1));
    const amanhaISO = amanhaDate.toISOString().slice(0, 10);

    // Feriado global?
    const { data: feriado } = await admin
      .from('ponto_feriados')
      .select('id')
      .eq('data', amanhaISO)
      .maybeSingle();
    if (feriado) {
      return jsonResp({ ok: true, motivo: 'feriado', data: amanhaISO });
    }

    // Buscar todos os agendamentos de amanhã
    const { data: agendamentos, error: agErr } = await admin
      .from('agenda_servicos')
      .select('id, atividade, profissional_id, consultor_id, aluno_id, data_especifica, dia_semana, horario_inicio, horario_fim, local, tipo, protocolo, observacoes')
      .eq('data_especifica', amanhaISO)
      .order('horario_inicio');
    if (agErr) throw agErr;

    if (!agendamentos?.length) {
      return jsonResp({ ok: true, motivo: 'sem_agendamentos', data: amanhaISO });
    }

    const results: unknown[] = [];

    for (const ag of agendamentos as any[]) {
      // Verificar se profissional está de férias/folga amanhã
      if (ag.profissional_id) {
        const { data: ausencia } = await admin
          .from('ponto_ferias')
          .select('id')
          .eq('usuario_id', ag.profissional_id)
          .lte('data_inicio', amanhaISO)
          .gte('data_fim', amanhaISO)
          .limit(1)
          .maybeSingle();
        if (ausencia) {
          results.push({ agenda_id: ag.id, atividade: ag.atividade, status: 'profissional_ausente' });
          continue;
        }
      }

      // Construir contexto completo do agendamento
      const ctx = await buildAgendaContext(admin, ag.id, ag);
      if (!ctx) {
        results.push({ agenda_id: ag.id, status: 'contexto_nao_encontrado' });
        continue;
      }

      // Destinatários: profissional + consultor (se houver e for diferente)
      const destinatarios: { userId: string; telefone: string | null; nome: string }[] = [];

      if (ag.profissional_id) {
        destinatarios.push({
          userId: ag.profissional_id,
          telefone: ctx.profTelefone,
          nome: ctx.profissional?.full_name ?? 'Profissional',
        });
      }

      if (ag.consultor_id && ag.consultor_id !== ag.profissional_id) {
        const { data: consultorPerfil } = await admin
          .from('profiles')
          .select('phone, full_name')
          .eq('user_id', ag.consultor_id)
          .maybeSingle();
        const consultorTel = normalizarTelefone((consultorPerfil as any)?.phone);
        if (consultorTel) {
          destinatarios.push({
            userId: ag.consultor_id,
            telefone: consultorTel,
            nome: (consultorPerfil as any)?.full_name ?? 'Consultor',
          });
        }
      }

      const configNome = ATIVIDADE_CONFIG[ag.atividade] ?? ag.atividade;

      for (const dest of destinatarios) {
        const telefone = normalizarTelefone(dest.telefone);
        if (!telefone) {
          results.push({ agenda_id: ag.id, destinatario: dest.nome, status: 'sem_telefone' });
          continue;
        }

        // Verificar férias do consultor
        const { data: ausenciaConsultor } = await admin
          .from('ponto_ferias')
          .select('id')
          .eq('usuario_id', dest.userId)
          .lte('data_inicio', amanhaISO)
          .gte('data_fim', amanhaISO)
          .limit(1)
          .maybeSingle();
        if (ausenciaConsultor) {
          results.push({ agenda_id: ag.id, destinatario: dest.nome, status: 'ausente' });
          continue;
        }

        // Montar payload com template correto para a atividade
        const templatePayload = buildTemplatePayload(configNome, 'agendamento_criado', ctx.vars, telefone);

        const send = templatePayload
          ? await callSendWhatsApp(templatePayload)
          : await callSendWhatsApp({
              to: telefone,
              type: 'text',
              text: sanitizeTextParam(
                `📅 Amanhã: ${ag.atividade} com ${ctx.aluno?.nome ?? '—'} às ${String(ag.horario_inicio).slice(0, 5)}. Local: ${ag.local ?? '—'}.`
              ),
            });

        // Log
        await admin.from('whatsapp_disparos_log').insert({
          config_id: CONFIG_ID,
          agenda_id: ag.id,
          aluno_id: ag.aluno_id ?? null,
          destinatario_telefone: telefone,
          destinatario_nome: dest.nome,
          mensagem_enviada: `Lembrete 20:40: ${ag.atividade}`,
          status: send.ok ? 'enviado' : 'erro',
          erro_detalhe: send.ok ? null : JSON.stringify({ error: send.error, details: send.details }),
        });

        results.push({ agenda_id: ag.id, atividade: ag.atividade, destinatario: dest.nome, status: send.ok ? 'enviado' : 'erro' });
      }
    }

    return jsonResp({ ok: true, data: amanhaISO, total: agendamentos.length, results });
  } catch (e) {
    console.error('[whatsapp-resumo-ponto]', e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
