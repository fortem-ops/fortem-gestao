// whatsapp-disparo-ponto — lembretes automáticos de ponto (cron a cada 5 min)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  normalizarTelefone,
  resolveNumberedTemplate,
  sendWhatsAppText,
  registrarNoChat,
} from '../_shared/whatsapp.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TZ = 'America/Sao_Paulo';
const JANELA_MIN = 5; // tolerância da janela de disparo (= frequência do cron)
const CORTE_SEM_HORARIO = 22 * 60; // 22:00 — corte de segurança para o resumo diário

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const GATILHOS = [
  'lembrete_entrada',
  'lembrete_intervalo_inicio',
  'lembrete_intervalo_fim',
  'lembrete_saida',
  'resumo_diario_ponto',
];

/** Data/hora atuais em America/Sao_Paulo. */
function agoraSP() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const data = `${parts.year}-${parts.month}-${parts.day}`;
  const minutos = Number(parts.hour) * 60 + Number(parts.minute);
  const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
  return { data, minutos, dow };
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

/** timestamptz ISO → minutos do dia em SP. */
function tsToMinSP(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function horaSP(iso: string | null | undefined): string {
  const m = tsToMinSP(iso);
  return m == null ? '—' : minToHHMM(m);
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDuracao(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** true quando `agora` está em [alvo, alvo + JANELA_MIN). */
function naJanela(agora: number, alvo: number | null): boolean {
  if (alvo == null) return false;
  return agora >= alvo && agora < alvo + JANELA_MIN;
}

async function jaEnviado(configId: string, usuarioId: string, data: string): Promise<boolean> {
  const { data: row } = await admin
    .from('whatsapp_disparos_log')
    .select('id')
    .eq('config_id', configId)
    .eq('usuario_id', usuarioId)
    .eq('referencia_data', data)
    .in('status', ['enviado', 'bloqueado_teste'])
    .limit(1)
    .maybeSingle();
  return !!row;
}

async function dispara(params: {
  cfg: any;
  usuarioId: string;
  nome: string | null;
  telefone: string | null;
  data: string;
  args: string[];
}): Promise<{ config: string; usuario: string; status: string; error?: string }> {
  const { cfg, usuarioId, nome, telefone, data, args } = params;
  const mensagem = resolveNumberedTemplate(cfg.template_texto ?? '', args);
  const tel = normalizarTelefone(telefone);

  if (!tel) {
    return { config: cfg.gatilho, usuario: usuarioId, status: 'sem_telefone' };
  }

  let status = 'enviado';
  let erro: string | null = null;

  if (cfg.modo_teste) {
    status = 'bloqueado_teste';
  } else {
    const send = await sendWhatsAppText(tel, mensagem);
    if (send.ok) {
      await registrarNoChat(admin, tel, nome, mensagem);
    } else {
      status = 'erro';
      erro = JSON.stringify({ error: send.error, details: send.details });
    }
  }

  await admin.from('whatsapp_disparos_log').insert({
    config_id: cfg.id,
    usuario_id: usuarioId,
    referencia_data: data,
    destinatario_telefone: tel,
    destinatario_nome: nome,
    mensagem_enviada: mensagem,
    status,
    erro_detalhe: erro,
  });

  return { config: cfg.gatilho, usuario: usuarioId, status, error: erro ?? undefined };
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

    const { data, minutos: agora, dow } = agoraSP();
    const dataBR = formatDataBR(data);
    const diaSemana = DIAS_SEMANA[dow];
    console.log(`[disparo-ponto] ${data} ${minToHHMM(agora)} (SP), dow=${dow}`);

    // Configs de ponto
    let q = admin
      .from('whatsapp_disparos_config')
      .select('id, nome, gatilho, ativo, modo_teste, offset_min, horario_fixo, template_texto')
      .eq('categoria', 'agendado')
      .in('gatilho', GATILHOS);
    if (!ignorarAtivo) q = q.eq('ativo', true);
    const { data: configs, error: cfgErr } = await q;
    if (cfgErr) throw cfgErr;

    const byGatilho = new Map<string, any>();
    for (const c of configs ?? []) byGatilho.set(c.gatilho, c);

    if (byGatilho.size === 0) {
      return new Response(JSON.stringify({ ok: true, results: [], info: 'nenhum disparo de ponto ativo' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Horários previstos do dia
    const { data: horarios, error: hErr } = await admin
      .from('ponto_horarios_professor')
      .select('usuario_id, horario_inicio, horario_fim, intervalo_min')
      .eq('dia_semana', dow)
      .eq('ativo', true);
    if (hErr) throw hErr;

    const horarioPorUsuario = new Map<string, any>();
    for (const h of horarios ?? []) horarioPorUsuario.set(h.usuario_id, h);

    // Jornadas de hoje (para checar batidas e alimentar o resumo diário)
    const { data: jornadas, error: jErr } = await admin
      .from('ponto_jornadas')
      .select('usuario_id, entrada, intervalo_inicio, intervalo_fim, saida, minutos_trabalhados')
      .eq('data', data);
    if (jErr) throw jErr;

    const jornadaPorUsuario = new Map<string, any>();
    for (const j of jornadas ?? []) jornadaPorUsuario.set(j.usuario_id, j);

    // Universo de profissionais: com horário previsto hoje + com entrada batida hoje
    const usuarios = new Set<string>([
      ...horarioPorUsuario.keys(),
      ...(jornadas ?? []).filter((j: any) => j.entrada).map((j: any) => j.usuario_id),
    ]);

    if (usuarios.size === 0) {
      return new Response(JSON.stringify({ ok: true, results: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: perfis } = await admin
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', Array.from(usuarios));
    const perfilPorUsuario = new Map<string, any>();
    for (const p of perfis ?? []) perfilPorUsuario.set(p.user_id, p);

    const results: unknown[] = [];

    for (const usuarioId of usuarios) {
      // Ausência (feriado / férias / folga / licença / atestado)
      const { data: ausencia } = await admin.rpc('fn_ponto_dia_ausencia', {
        _user_id: usuarioId,
        _data: data,
      });
      if (ausencia) {
        results.push({ usuario: usuarioId, status: 'ausente', motivo: ausencia });
        continue;
      }

      const perfil = perfilPorUsuario.get(usuarioId);
      const nome = perfil?.full_name ?? null;
      const telefone = perfil?.phone ?? null;
      const horario = horarioPorUsuario.get(usuarioId);
      const jornada = jornadaPorUsuario.get(usuarioId);

      const inicio = timeToMin(horario?.horario_inicio);
      const fim = timeToMin(horario?.horario_fim);
      const intervaloMin = Number(horario?.intervalo_min ?? 0);

      const varsBase: Record<string, string> = {
        '%NOME_PROFISSIONAL%': nome ?? '',
        '%DATA%': dataBR,
        '%DIA_SEMANA%': diaSemana,
        '%INTERVALO_MIN%': String(intervaloMin),
      };

      // --- lembrete_entrada ---
      const cfgEntrada = byGatilho.get('lembrete_entrada');
      if (cfgEntrada && inicio != null && !jornada?.entrada) {
        const alvo = inicio + (cfgEntrada.offset_min ?? 0);
        if (naJanela(agora, alvo) && !(await jaEnviado(cfgEntrada.id, usuarioId, data))) {
          results.push(await dispara({
            cfg: cfgEntrada, usuarioId, nome, telefone, data,
            vars: { ...varsBase, '%HORA_PREVISTA%': minToHHMM(inicio) },
          }));
        }
      }

      // --- lembrete_intervalo (meio da janela prevista) ---
      const cfgIntervalo = byGatilho.get('lembrete_intervalo');
      if (
        cfgIntervalo && inicio != null && fim != null && intervaloMin > 0 &&
        jornada?.entrada && !jornada?.intervalo_inicio
      ) {
        const alvo = Math.round(inicio + (fim - inicio) / 2) + (cfgIntervalo.offset_min ?? 0);
        if (naJanela(agora, alvo) && !(await jaEnviado(cfgIntervalo.id, usuarioId, data))) {
          results.push(await dispara({
            cfg: cfgIntervalo, usuarioId, nome, telefone, data,
            vars: { ...varsBase, '%HORA_PREVISTA%': minToHHMM(alvo) },
          }));
        }
      }

      // --- lembrete_saida ---
      const cfgSaida = byGatilho.get('lembrete_saida');
      if (cfgSaida && fim != null && jornada?.entrada && !jornada?.saida) {
        const alvo = fim + (cfgSaida.offset_min ?? 0);
        if (naJanela(agora, alvo) && !(await jaEnviado(cfgSaida.id, usuarioId, data))) {
          results.push(await dispara({
            cfg: cfgSaida, usuarioId, nome, telefone, data,
            vars: { ...varsBase, '%HORA_PREVISTA%': minToHHMM(fim) },
          }));
        }
      }

      // --- resumo_diario_ponto ---
      const cfgResumo = byGatilho.get('resumo_diario_ponto');
      if (cfgResumo && jornada?.entrada) {
        let alvo: number | null = null;
        if (jornada.saida) {
          const saidaMin = tsToMinSP(jornada.saida);
          alvo = saidaMin == null ? null : saidaMin + 10;
        } else if (fim != null) {
          alvo = fim + 30;
        } else {
          alvo = timeToMin(cfgResumo.horario_fixo) ?? CORTE_SEM_HORARIO;
        }

        // Após o alvo (não só na janela) para garantir que o resumo sempre saia
        if (alvo != null && agora >= alvo && !(await jaEnviado(cfgResumo.id, usuarioId, data))) {
          const intervaloTxt = jornada.intervalo_inicio
            ? `${horaSP(jornada.intervalo_inicio)} às ${jornada.intervalo_fim ? horaSP(jornada.intervalo_fim) : 'não finalizado'}`
            : 'não registrado';
          results.push(await dispara({
            cfg: cfgResumo, usuarioId, nome, telefone, data,
            vars: {
              ...varsBase,
              '%HORA_ENTRADA%': horaSP(jornada.entrada),
              '%HORA_SAIDA%': jornada.saida ? horaSP(jornada.saida) : 'NÃO REGISTRADA',
              '%INTERVALO%': intervaloTxt,
              '%TEMPO_TRABALHADO%': formatDuracao(jornada.minutos_trabalhados),
              '%AVISO%': jornada.saida
                ? ''
                : '⚠️ Sua saída não foi registrada hoje. Acesse o módulo Ponto para regularizar.',
            },
          }));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, agora: minToHHMM(agora), data, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[whatsapp-disparo-ponto]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
