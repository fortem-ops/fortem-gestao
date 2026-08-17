// whatsapp-resumo-ponto — resumo diário (20:40 BRT) dos agendamentos de amanhã por profissional.
// Template Meta: ponto_resumo_diario ({{1}} primeiro nome, {{2}} lista de agendamentos)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizarTelefone } from '../_shared/whatsapp.ts';

const CONFIG_ID = 'b41e481e-d101-4a10-94b9-2e26a65a4823';
const TZ = 'America/Sao_Paulo';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Item = { horario: string; atividade: string; aluno: string };

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

    const { data: agendamentos, error: agErr } = await admin
      .from('agenda_servicos')
      .select('id, horario_inicio, atividade, aluno_id, profissional_id, consultor_id')
      .eq('data_especifica', amanhaISO)
      .order('horario_inicio');
    if (agErr) throw agErr;

    if (!agendamentos || agendamentos.length === 0) {
      return jsonResp({ ok: true, motivo: 'sem_agendamentos', data: amanhaISO });
    }

    // Nomes de alunos
    const alunoIds = [...new Set(agendamentos.map((a: any) => a.aluno_id).filter(Boolean))];
    const alunoNomes = new Map<string, string>();
    if (alunoIds.length) {
      const { data: alunos } = await admin.from('alunos').select('id, nome').in('id', alunoIds);
      for (const al of (alunos ?? []) as any[]) alunoNomes.set(al.id, al.nome);
    }

    // Perfis dos profissionais/consultores
    const userIds = [
      ...new Set(
        agendamentos
          .flatMap((a: any) => [a.profissional_id, a.consultor_id])
          .filter(Boolean),
      ),
    ] as string[];
    const perfis = new Map<string, { full_name: string | null; phone: string | null }>();
    if (userIds.length) {
      const { data: profs } = await admin
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', userIds);
      for (const p of (profs ?? []) as any[]) {
        perfis.set(p.user_id, { full_name: p.full_name, phone: p.phone });
      }
    }

    const porProfissional: Record<string, { user_id: string; nome: string; items: Item[] }> = {};
    const add = (userId: string | null, item: Item) => {
      if (!userId) return;
      if (!porProfissional[userId]) {
        porProfissional[userId] = {
          user_id: userId,
          nome: perfis.get(userId)?.full_name ?? 'Profissional',
          items: [],
        };
      }
      porProfissional[userId].items.push(item);
    };

    for (const ag of agendamentos as any[]) {
      const horario = String(ag.horario_inicio ?? '').slice(0, 5);
      const item: Item = {
        horario,
        atividade: ag.atividade ?? 'Serviço',
        aluno: (ag.aluno_id ? alunoNomes.get(ag.aluno_id) : null) ?? '—',
      };
      add(ag.profissional_id, item);
      if (ag.consultor_id && ag.consultor_id !== ag.profissional_id) add(ag.consultor_id, item);
    }

    const results: unknown[] = [];

    for (const [userId, prof] of Object.entries(porProfissional)) {
      // Férias / afastamento amanhã
      const { data: ausencia } = await admin
        .from('ponto_ferias')
        .select('id')
        .eq('usuario_id', userId)
        .lte('data_inicio', amanhaISO)
        .gte('data_fim', amanhaISO)
        .limit(1)
        .maybeSingle();
      if (ausencia) {
        results.push({ profissional: prof.nome, status: 'ausente' });
        continue;
      }

      const telefone = normalizarTelefone(perfis.get(userId)?.phone ?? null);
      if (!telefone) {
        results.push({ profissional: prof.nome, status: 'sem_telefone' });
        continue;
      }

      const lista = prof.items
        .sort((a, b) => a.horario.localeCompare(b.horario))
        .map((i) => `${i.horario} - ${i.atividade} (${i.aluno})`)
        .join(' | ');

      const payload = {
        to: telefone,
        template_name: 'ponto_resumo_diario',
        language: 'pt_BR',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: prof.nome.split(' ')[0] },
              { type: 'text', text: lista },
            ],
          },
        ],
      };

      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          'x-supabase-service-role': 'true',
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      const ok = resp.ok && !(json as any)?.error;

      await admin.from('whatsapp_disparos_log').insert({
        config_id: CONFIG_ID,
        usuario_id: userId,
        referencia_data: amanhaISO,
        destinatario_telefone: telefone,
        destinatario_nome: prof.nome,
        mensagem_enviada: lista,
        status: ok ? 'enviado' : 'erro',
        erro_detalhe: ok ? null : JSON.stringify(json),
      });

      results.push({ profissional: prof.nome, status: ok ? 'enviado' : 'erro' });
    }

    return jsonResp({ ok: true, data: amanhaISO, results });
  } catch (e) {
    console.error('[whatsapp-resumo-ponto]', e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
