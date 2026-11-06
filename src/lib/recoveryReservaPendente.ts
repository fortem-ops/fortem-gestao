// Horário escolhido antes de comprar 1 sessão avulsa de Recovery pelo portal.
// Fica só no navegador por 2 horas; o agendamento real é sempre feito pela
// função de agendamento existente (fn_agendar_servico), que confere crédito e vaga.

const CHAVE = "fortem:recovery-reserva-pendente";
export const VALIDADE_RESERVA_MS = 2 * 60 * 60 * 1000;

export type ReservaPendente = {
  aluno_id: string;
  agenda_id: string;
  data: string; // yyyy-MM-dd
  atividade: string;
  horario: string; // HH:mm
  criado_em: number;
};

export function salvarReservaPendente(r: Omit<ReservaPendente, "criado_em">, agora = Date.now()) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...r, criado_em: agora }));
  } catch {
    /* navegador sem armazenamento: segue sem agendamento automático */
  }
}

export function lerReservaPendente(alunoId?: string | null, agora = Date.now()): ReservaPendente | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as ReservaPendente;
    if (!r?.agenda_id || !r?.data || typeof r.criado_em !== "number") {
      limparReservaPendente();
      return null;
    }
    if (agora - r.criado_em > VALIDADE_RESERVA_MS) {
      limparReservaPendente();
      return null;
    }
    if (alunoId && r.aluno_id !== alunoId) return null;
    return r;
  } catch {
    return null;
  }
}

export function limparReservaPendente() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}
