// whatsapp-disparo-agenda — redeploy trigger 2026-07-09 (normalize phone)

function normalizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');

  // Já tem DDI 55 com pelo menos 10 dígitos locais
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }

  // Sem DDI: adiciona 55
  if (digits.length >= 10) {
    return '55' + digits;
  }

  return digits;
}
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

function formatDateBR(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatHora(hhmmss: string | null): string {
  if (!hhmmss) return '';
  return hhmmss.slice(0, 5);
}

function diaSemanaFromISO(iso: string | null, fallbackIdx: number): string {
  if (iso) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      return DIAS_SEMANA[dt.getUTCDay()];
    }
  }
  return DIAS_SEMANA[fallbackIdx] ?? '';
}

function cargoFromRole(specialty: string | null): string {
  const s = (specialty ?? '').toLowerCase();
  if (s.includes('fisio')) return 'Fisioterapeuta';
  if (s.includes('nutri')) return 'Nutricionista';
  return 'Treinador(a)';
}

async function roleOfUser(userId: string): Promise<string | null> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('role')
    .limit(1)
    .maybeSingle();
  return (data as any)?.role ?? null;
}

function cargoFromAppRole(role: string | null): string {
  if (!role) return 'Treinador(a)';
  if (role === 'fisioterapeuta') return 'Fisioterapeuta';
  if (role === 'nutricionista') return 'Nutricionista';
  return 'Treinador(a)';
}

async function buildContext(agendaId: string) {
  const { data: agenda } = await admin
    .from('agenda_servicos')
    .select('*')
    .eq('id', agendaId)
    .maybeSingle();
  if (!agenda) return null;

  const [alunoRes, profRes] = await Promise.all([
    agenda.aluno_id
      ? admin.from('alunos').select('id, nome, data_nascimento, telefone').eq('id', agenda.aluno_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('profiles').select('user_id, full_name, phone, specialty').eq('user_id', agenda.profissional_id).maybeSingle(),
  ]);

  const aluno = (alunoRes as any).data;
  const profissional = (profRes as any).data;

  let anamnese: any = null;
  let ultimaAvaliacao: any = null;
  if (agenda.aluno_id) {
    const [anaRes, avalRes] = await Promise.all([
      admin.from('prospect_anamnese').select('*').eq('aluno_id', agenda.aluno_id).maybeSingle(),
      admin.from('avaliacoes').select('data_avaliacao, created_at').eq('aluno_id', agenda.aluno_id)
        .order('data_avaliacao', { ascending: false }).limit(1).maybeSingle(),
    ]);
    anamnese = (anaRes as any).data;
    ultimaAvaliacao = (avalRes as any).data;
  }

  const profRole = profissional ? await roleOfUser(profissional.user_id) : null;

  const vars: Record<string, string> = {
    '%TIPO_SERVICO%': agenda.atividade ?? '',
    '%DIA_SEMANA%': diaSemanaFromISO(agenda.data_especifica, agenda.dia_semana ?? 0),
    '%DATA%': formatDateBR(agenda.data_especifica),
    '%HORA_INICIO%': formatHora(agenda.horario_inicio),
    '%HORA_FIM%': formatHora(agenda.horario_fim),
    '%NOME_PROFISSIONAL%': profissional?.full_name ?? '',
    '%CARGO_PROFISSIONAL%': cargoFromAppRole(profRole) || cargoFromRole(profissional?.specialty ?? null),
    '%NOME_ALUNO%': aluno?.nome ?? '',
    '%DATA_NASCIMENTO%': formatDateBR(aluno?.data_nascimento ?? null),
    '%LIMITACOES%': anamnese?.limitacoes ?? '—',
    '%ATIVIDADE_FISICA%': anamnese?.atividade_fisica ?? '—',
    '%OBJETIVO%': anamnese?.objetivo_treinamento ?? '—',
    '%COMO_CONHECEU%': anamnese?.como_conheceu ?? '—',
    '%QUEIXA%': anamnese?.queixa ?? anamnese?.limitacoes ?? '—',
    '%ULTIMA_AVALIACAO%': formatDateBR(ultimaAvaliacao?.data_avaliacao ?? null) || 'Nenhuma',
    '%PROTOCOLO%': agenda.protocolo ?? '—',
  };

  return {
    agenda,
    aluno,
    profissional,
    profTelefone: profissional?.phone ?? null,
    alunoTelefone: aluno?.telefone ?? null,
    vars,
  };
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/%[A-Z_]+%/g, (m) => (m in vars ? vars[m] : m));
}

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

async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  language: string,
  components: unknown[],
) {
  return callSendWhatsApp({ to, template_name: templateName, language, components });
}

function buildTemplatePayload(
  configNome: string,
  gatilho: string,
  vars: Record<string, string>,
  destinoTelefone: string,
): Record<string, unknown> | null {
  const p = (v: string) => ({ type: 'text', text: vars[v] || '' });
  const dataCompleta = vars['%DIA_SEMANA%'] && vars['%DATA%']
    ? `${vars['%DIA_SEMANA%']}, ${vars['%DATA%']}`
    : vars['%DATA%'] || '';

  if (gatilho === 'agendamento_cancelado') {
    return {
      to: destinoTelefone, template_name: 'cancelamento_aviso', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        p('%TIPO_SERVICO%'), p('%DATA%'), p('%HORA_INICIO%'), p('%NOME_ALUNO%'),
      ]}],
    };
  }

  if (configNome.startsWith('Treino Experimental')) {
    return {
      to: destinoTelefone, template_name: 'aviso_treino_experimental', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        p('%TIPO_SERVICO%'),
        { type: 'text', text: dataCompleta },
        p('%HORA_INICIO%'),
        p('%NOME_PROFISSIONAL%'),
        p('%NOME_ALUNO%'),
        p('%DATA_NASCIMENTO%'),
        p('%COMO_CONHECEU%'),
        p('%LIMITACOES%'),
        p('%ATIVIDADE_FISICA%'),
        p('%OBJETIVO%'),
      ]}],
    };
  }

  if (configNome.startsWith('Avaliação Funcional')) {
    return {
      to: destinoTelefone, template_name: 'aviso_avaliacao_funcional', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        p('%TIPO_SERVICO%'),
        { type: 'text', text: dataCompleta },
        p('%HORA_INICIO%'),
        p('%NOME_PROFISSIONAL%'),
        p('%NOME_ALUNO%'),
        p('%DATA_NASCIMENTO%'),
        p('%ULTIMA_AVALIACAO%'),
        p('%PROTOCOLO%'),
      ]}],
    };
  }

  if (configNome.startsWith('Reabilitação') && !configNome.startsWith('Reabilitação/Nutrição')) {
    return {
      to: destinoTelefone, template_name: 'aviso_consulta_reabilitacao', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        { type: 'text', text: dataCompleta },
        p('%HORA_INICIO%'),
        p('%NOME_PROFISSIONAL%'),
        p('%NOME_ALUNO%'),
        p('%DATA_NASCIMENTO%'),
        p('%QUEIXA%'),
      ]}],
    };
  }

  if (configNome.startsWith('Nutrição') || configNome.startsWith('Reabilitação/Nutrição')) {
    return {
      to: destinoTelefone, template_name: 'aviso_consulta_nutricao', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        { type: 'text', text: dataCompleta },
        p('%HORA_INICIO%'),
        p('%NOME_PROFISSIONAL%'),
        p('%NOME_ALUNO%'),
        p('%DATA_NASCIMENTO%'),
      ]}],
    };
  }

  return null;
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

    const ctx = await buildContext(agendaId);
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
