// Contexto e montagem de parâmetros dos templates Meta de agenda.
// Extraído de whatsapp-disparo-agenda para ser reaproveitado pelo resumo do dia anterior.
// Regras de negócio idênticas às originais — não alterar comportamento.

export const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export function formatDateBR(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatHora(hhmmss: string | null): string {
  if (!hhmmss) return '';
  return hhmmss.slice(0, 5);
}

export function diaSemanaFromISO(iso: string | null, fallbackIdx: number): string {
  if (iso) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      return DIAS_SEMANA[dt.getUTCDay()];
    }
  }
  return DIAS_SEMANA[fallbackIdx] ?? '';
}

export function cargoFromRole(specialty: string | null): string {
  const s = (specialty ?? '').toLowerCase();
  if (s.includes('fisio')) return 'Fisioterapeuta';
  if (s.includes('nutri')) return 'Nutricionista';
  return 'Treinador(a)';
}

export function cargoFromAppRole(role: string | null): string {
  if (!role) return 'Treinador(a)';
  if (role === 'fisioterapeuta') return 'Fisioterapeuta';
  if (role === 'nutricionista') return 'Nutricionista';
  return 'Treinador(a)';
}

export function sanitizeTextParam(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export async function roleOfUser(admin: any, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('role')
    .limit(1)
    .maybeSingle();
  return (data as any)?.role ?? null;
}

export type AgendaContext = {
  agenda: any;
  aluno: any;
  profissional: any;
  profTelefone: string | null;
  alunoTelefone: string | null;
  vars: Record<string, string>;
};

export async function buildAgendaContext(
  admin: any,
  agendaId: string,
  snapshot?: Record<string, unknown> | null,
): Promise<AgendaContext | null> {
  let agenda: any = null;

  if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0) {
    agenda = { id: agendaId, ...snapshot };
  } else {
    const { data } = await admin
      .from('agenda_servicos')
      .select('id, atividade, profissional_id, consultor_id, aluno_id, data_especifica, dia_semana, horario_inicio, horario_fim, local, tipo, protocolo, observacoes')
      .eq('id', agendaId)
      .maybeSingle();
    agenda = data;
  }
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
  let pipelineMeta: any = null;
  if (agenda.aluno_id) {
    const [anaRes, avalRes, metaRes] = await Promise.all([
      admin.from('prospect_anamnese').select('*').eq('aluno_id', agenda.aluno_id).maybeSingle(),
      admin.from('avaliacoes').select('data_avaliacao, created_at').eq('aluno_id', agenda.aluno_id)
        .order('data_avaliacao', { ascending: false }).limit(1).maybeSingle(),
      admin.from('pipeline_metadata').select('origem_lead').eq('aluno_id', agenda.aluno_id).maybeSingle(),
    ]);
    anamnese = (anaRes as any).data;
    ultimaAvaliacao = (avalRes as any).data;
    pipelineMeta = (metaRes as any).data;
  }

  const profRole = profissional ? await roleOfUser(admin, profissional.user_id) : null;

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
    '%COMO_CONHECEU%': pipelineMeta?.origem_lead ?? '—',
    '%QUEIXA%': anamnese?.queixa ?? anamnese?.limitacoes ?? '—',
    '%ULTIMA_AVALIACAO%': formatDateBR(ultimaAvaliacao?.data_avaliacao ?? null) || 'Nenhuma',
    '%PROTOCOLO%': agenda.protocolo ?? '—',
    '%OBSERVACOES%': (agenda as any).observacoes ?? '—',
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

export function buildTemplatePayload(
  configNome: string,
  gatilho: string,
  vars: Record<string, string>,
  destinoTelefone: string,
): Record<string, unknown> | null {
  const safe = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    const s = String(v).trim();
    return s === '' ? '—' : sanitizeTextParam(s);
  };
  const p = (v: string) => ({ type: 'text', text: safe(vars[v]) });
  const dataCompleta = safe(
    vars['%DIA_SEMANA%'] && vars['%DATA%']
      ? `${vars['%DIA_SEMANA%']}, ${vars['%DATA%']}`
      : vars['%DATA%']
  );

  if (gatilho === 'agendamento_cancelado') {
    return {
      to: destinoTelefone, template_name: 'cancelamento_aviso', language: 'pt_BR',
      components: [{ type: 'body', parameters: [
        p('%TIPO_SERVICO%'), p('%DATA%'), p('%HORA_INICIO%'), p('%NOME_ALUNO%'),
      ]}],
    };
  }

  if (configNome.startsWith('Treino Experimental') || configNome.startsWith('Resumo Treino Experimental')) {
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
        p('%OBSERVACOES%'),
      ]}],
    };
  }

  if (configNome.startsWith('Avaliação Funcional') || configNome.startsWith('Resumo Avaliação Funcional')) {
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
        p('%OBSERVACOES%'),
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
        p('%OBSERVACOES%'),
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
        p('%OBSERVACOES%'),
      ]}],
    };
  }

  return null;
}
