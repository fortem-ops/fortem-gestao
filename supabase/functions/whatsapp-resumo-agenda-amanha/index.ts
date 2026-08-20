// whatsapp-resumo-agenda-amanha — avisos do dia anterior (cron a cada 5 min, dispara na janela do horario_fixo)
// Cada agendamento de amanhã gera UMA mensagem completa para o profissional,
// reaproveitando os templates Meta já aprovados (aviso_treino_experimental / aviso_avaliacao_funcional).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  normalizarTelefone,
  resolveTemplate,
  callSendWhatsApp,
  sendWhatsAppText,
  registrarNoChat,
} from '../_shared/whatsapp.ts';
import { buildAgendaContext, buildTemplatePayload } from '../_shared/agenda-template.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TZ = 'America/Sao_Paulo';
const JANELA_MIN = 5; // tolerância da janela de disparo (= frequência do cron)

const GATILHOS = [
  'resumo_treino_experimental_amanha',
  'resumo_avaliacao_funcional_amanha',
];

/** Data/hora atuais em America/Sao_Paulo. */
function agoraSP() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const data = `${parts.year}-${parts.month}-${parts.day}`;
  const minutos = Number(parts.hour) * 60 + Number(parts.minute);
  return { data, minutos };
}

/** ISO date + N dias. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** "HH:MM[:SS]" → minutos do dia. */
function timeToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** true quando `agora` está em [alvo, alvo + JANELA_MIN). */
function naJanela(agora: number, alvo: number | null): boolean {
  if (alvo == null) return false;
  return agora >= alvo && agora < alvo + JANELA_MIN;
}

/** Idempotência por agendamento: whatsapp_disparos_log.agenda_id identifica o agendamento específico. */
async function jaEnviado(configId: string, agendaId: string): Promise<boolean> {
  const { data } = await admin
    .from('whatsapp_disparos_log')
    .select('id')
    .eq('config_id', configId)
    .eq('agenda_id', agendaId)
    .in('status', ['enviado', 'bloqueado_teste'])
    .limit(1)
    .maybeSingle();
  return !!data;
}

let _cachedSecret: string | null = null;

/** Autoriza cron (x-webhook-secret), service role, ou usuário staff logado. */
async function autorizar(req: Request): Promise<boolean> {
  const provided = req.headers.get('x-webhook-secret');
  if (provided) {
    if (!_cachedSecret) {
      const { data } = await admin.rpc('get_webhook_secret');
      _cachedSecret = typeof data === 'string' ? data : null;
    }
    if (_cachedSecret && provided === _cachedSecret) return true;
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (auth === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`) return true;

  if (auth.startsWith('Bearer ')) {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (u?.user) {
      const { data: isStaff } = await admin.rpc('is_staff', { _user_id: u.user.id });
      if (isStaff) return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await autorizar(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ignorarAtivo = (body as any)?.force === true;
    const ignorarJanela = (body as any)?.force === true;

    const { data: hoje, minutos: agora } = agoraSP();
    const amanha = addDays(hoje, 1);
    console.log(`[resumo-agenda-amanha] ${hoje} ${minToHHMM(agora)} (SP) → alvo ${amanha}`);

    let q = admin
      .from('whatsapp_disparos_config')
      .select('id, nome, gatilho, ativo, modo_teste, horario_fixo, atividades, template_texto, destinatario')
      .eq('categoria', 'agendado')
      .in('gatilho', GATILHOS);
    if (!ignorarAtivo) q = q.eq('ativo', true);
    const { data: configs, error: cfgErr } = await q;
    if (cfgErr) throw cfgErr;

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, results: [], info: 'nenhum resumo de agenda ativo' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: unknown[] = [];

    for (const cfg of configs as any[]) {
      const alvo = timeToMin(cfg.horario_fixo);
      if (!ignorarJanela && !naJanela(agora, alvo)) {
        results.push({ config: cfg.nome, status: 'fora_da_janela', horario_fixo: cfg.horario_fixo });
        continue;
      }

      const atividades: string[] = Array.isArray(cfg.atividades) ? cfg.atividades : [];
      if (atividades.length === 0) {
        results.push({ config: cfg.nome, status: 'sem_atividades_configuradas' });
        continue;
      }

      const { data: agendamentos, error: agErr } = await admin
        .from('agenda_servicos')
        .select('id, profissional_id, consultor_id')
        .eq('data_especifica', amanha)
        .in('atividade', atividades);
      if (agErr) throw agErr;

      if (!agendamentos || agendamentos.length === 0) {
        results.push({ config: cfg.nome, status: 'sem_agendamentos', data: amanha });
        continue;
      }

      const paraConsultor = cfg.destinatario === 'consultor';

      for (const ag of agendamentos as any[]) {
        // Consultor não preenchido: pula silenciosamente (esperado).
        if (paraConsultor && !ag.consultor_id) continue;

        if (await jaEnviado(cfg.id, ag.id)) {
          results.push({ config: cfg.nome, agenda_id: ag.id, status: 'ja_enviado' });
          continue;
        }

        const ctx = await buildAgendaContext(admin, ag.id);
        if (!ctx) {
          results.push({ config: cfg.nome, agenda_id: ag.id, status: 'contexto_nao_encontrado' });
          continue;
        }

        // Mesma mensagem/parâmetros do profissional — só muda o destinatário.
        const consultor = paraConsultor ? await buscarPerfil(ag.consultor_id) : null;
        if (paraConsultor && !consultor) {
          results.push({ config: cfg.nome, agenda_id: ag.id, status: 'consultor_nao_encontrado' });
          continue;
        }

        const destinoUserId = paraConsultor ? ag.consultor_id : (ag.profissional_id ?? null);
        const destinoTelefone = normalizarTelefone(paraConsultor ? consultor?.phone ?? null : ctx.profTelefone);
        const destinoNome = paraConsultor ? consultor?.full_name ?? null : ctx.profissional?.full_name ?? null;
        const mensagem = resolveTemplate(cfg.template_texto ?? '', ctx.vars);


        if (cfg.modo_teste) {
          await admin.from('whatsapp_disparos_log').insert({
            config_id: cfg.id,
            agenda_id: ag.id,
            aluno_id: ctx.agenda.aluno_id ?? null,
            usuario_id: ag.profissional_id ?? null,
            referencia_data: amanha,
            destinatario_telefone: destinoTelefone,
            destinatario_nome: destinoNome,
            mensagem_enviada: mensagem,
            status: 'bloqueado_teste',
          });
          results.push({ config: cfg.nome, agenda_id: ag.id, status: 'bloqueado_teste' });
          continue;
        }

        if (!destinoTelefone) {
          await admin.from('whatsapp_disparos_log').insert({
            config_id: cfg.id,
            agenda_id: ag.id,
            aluno_id: ctx.agenda.aluno_id ?? null,
            usuario_id: ag.profissional_id ?? null,
            referencia_data: amanha,
            destinatario_telefone: null,
            destinatario_nome: destinoNome,
            mensagem_enviada: mensagem,
            status: 'erro',
            erro_detalhe: 'Sem telefone cadastrado',
          });
          results.push({ config: cfg.nome, agenda_id: ag.id, status: 'erro', reason: 'sem_telefone' });
          continue;
        }

        const templatePayload = buildTemplatePayload(cfg.nome, cfg.gatilho, ctx.vars, destinoTelefone);
        const send = templatePayload
          ? await callSendWhatsApp(templatePayload)
          : await sendWhatsAppText(destinoTelefone, mensagem);

        await admin.from('whatsapp_disparos_log').insert({
          config_id: cfg.id,
          agenda_id: ag.id,
          aluno_id: ctx.agenda.aluno_id ?? null,
          usuario_id: ag.profissional_id ?? null,
          referencia_data: amanha,
          destinatario_telefone: destinoTelefone,
          destinatario_nome: destinoNome,
          mensagem_enviada: mensagem,
          status: send.ok ? 'enviado' : 'erro',
          erro_detalhe: send.ok ? null : JSON.stringify({ error: send.error, details: send.details }),
        });

        if (send.ok) {
          await registrarNoChat(admin, destinoTelefone, destinoNome, mensagem);
        }

        results.push({
          config: cfg.nome, agenda_id: ag.id,
          status: send.ok ? 'enviado' : 'erro', error: send.error,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, agora: minToHHMM(agora), data_alvo: amanha, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[whatsapp-resumo-agenda-amanha]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
