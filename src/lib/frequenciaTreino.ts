import { supabase } from "@/integrations/supabase/client";

export const MARCA_REGISTRO_EQUIPE = "registro_equipe";

export type SessaoFrequencia = {
  id: string;
  aluno_id: string;
  treino_id: string;
  agendamento_id: string | null;
  variacao: string;
  variacao_original: string | null;
  foi_troca: boolean;
  data: string;
  concluido_em: string | null;
  observacoes: string | null;
};

export type AgendamentoFrequencia = {
  id: string;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string;
};

export type LinhaFrequencia = {
  key: string;
  data: string;
  horarioInicio: string | null;
  status: string;
  agendamentoId: string | null;
  sessao: SessaoFrequencia | null;
  propostoVariacao: string | null;
  realizadoVariacao: string | null;
  foiTroca: boolean;
  registradoPelaEquipe: boolean;
  semAgendamento: boolean;
};

/** Converte "T3" em índice 0-based; retorna null se não reconhecido. */
export function indiceVariacao(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^T(\d+)$/i.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n - 1 : null;
}

export function nomeVariacao(idx: number): string {
  return `T${idx + 1}`;
}

/**
 * Monta as linhas de frequência cruzando agendamentos com sessões registradas.
 * O "proposto" segue a rotação T1→T2→…→Tn a partir das sessões já concluídas,
 * mesma lógica usada no portal do aluno.
 */
export function montarLinhasFrequencia(params: {
  agendamentos: AgendamentoFrequencia[];
  sessoes: SessaoFrequencia[];
  numVariacoes: number;
}): LinhaFrequencia[] {
  const n = Math.max(1, params.numVariacoes || 4);
  const porAgendamento = new Map<string, SessaoFrequencia>();
  const soltas: SessaoFrequencia[] = [];
  for (const s of params.sessoes) {
    if (s.agendamento_id) porAgendamento.set(s.agendamento_id, s);
    else soltas.push(s);
  }

  type Bruta = {
    key: string;
    data: string;
    horarioInicio: string | null;
    status: string;
    agendamentoId: string | null;
    sessao: SessaoFrequencia | null;
    semAgendamento: boolean;
  };

  const brutas: Bruta[] = [
    ...params.agendamentos.map((a) => ({
      key: a.id,
      data: a.data,
      horarioInicio: a.horario_inicio,
      status: a.status,
      agendamentoId: a.id,
      sessao: porAgendamento.get(a.id) ?? null,
      semAgendamento: false,
    })),
    ...soltas.map((s) => ({
      key: `sessao-${s.id}`,
      data: s.data,
      horarioInicio: null,
      status: "realizado",
      agendamentoId: null,
      sessao: s,
      semAgendamento: true,
    })),
  ];

  // Ordem cronológica ascendente para calcular a rotação
  brutas.sort((a, b) =>
    a.data === b.data
      ? (a.horarioInicio ?? "").localeCompare(b.horarioInicio ?? "")
      : a.data.localeCompare(b.data),
  );

  let contador = 0;
  const linhas: LinhaFrequencia[] = brutas.map((b) => {
    const s = b.sessao;
    let proposto: string | null = null;
    let realizado: string | null = null;

    if (s) {
      realizado = s.variacao;
      proposto = s.variacao_original ?? s.variacao;
      const idx = indiceVariacao(proposto);
      contador = (idx !== null ? idx : contador % n) + 1;
    } else if (b.status === "cancelado") {
      proposto = null;
    } else {
      proposto = nomeVariacao(contador % n);
      contador += 1;
    }

    return {
      key: b.key,
      data: b.data,
      horarioInicio: b.horarioInicio,
      status: b.status,
      agendamentoId: b.agendamentoId,
      sessao: s,
      propostoVariacao: proposto,
      realizadoVariacao: realizado,
      foiTroca: !!s && !!s.variacao_original && s.variacao_original !== s.variacao,
      registradoPelaEquipe: !!s && (s.observacoes ?? "").includes(MARCA_REGISTRO_EQUIPE),
      semAgendamento: b.semAgendamento,
    };
  });

  // Mais recentes primeiro para exibição
  return linhas.reverse();
}

/**
 * Registra (ou atualiza) a sessão de um treino numa data e marca o
 * agendamento como realizado. Compartilhado entre portal e perfil do aluno.
 */
export async function registrarSessao(params: {
  alunoId: string;
  treinoId: string;
  variacao: string;
  variacaoOriginal?: string | null;
  foiTroca?: boolean;
  agendamentoId: string | null;
  data: string;
  sessaoExistenteId?: string | null;
  registradoPelaEquipe?: boolean;
  concluidoEm?: string;
}) {
  const concluidoEm = params.concluidoEm ?? new Date(params.data + "T12:00:00").toISOString();
  const payload: Record<string, unknown> = {
    aluno_id: params.alunoId,
    treino_id: params.treinoId,
    variacao: params.variacao,
    variacao_original: params.variacaoOriginal ?? null,
    foi_troca: params.foiTroca ?? false,
    agendamento_id: params.agendamentoId,
    data: params.data,
    concluido_em: concluidoEm,
    observacoes: params.registradoPelaEquipe ? MARCA_REGISTRO_EQUIPE : null,
  };

  if (params.sessaoExistenteId) {
    const { error } = await (supabase as any)
      .from("treino_sessoes")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", params.sessaoExistenteId);
    if (error) throw error;
  } else {
    const { error } = await (supabase as any).from("treino_sessoes").insert(payload);
    if (error) throw error;
  }

  if (params.agendamentoId) {
    await supabase
      .from("treino_agendamentos")
      .update({ status: "realizado", updated_at: new Date().toISOString() })
      .eq("id", params.agendamentoId);
  }
}

/** Remove o registro da sessão e devolve o agendamento para "confirmado". */
export async function removerSessao(sessao: { id: string; agendamento_id: string | null }) {
  const { error } = await (supabase as any)
    .from("treino_sessoes")
    .delete()
    .eq("id", sessao.id);
  if (error) throw error;
  if (sessao.agendamento_id) {
    await supabase
      .from("treino_agendamentos")
      .update({ status: "confirmado", updated_at: new Date().toISOString() })
      .eq("id", sessao.agendamento_id);
  }
}
