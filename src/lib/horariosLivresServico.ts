// Monta os horários livres de um serviço a partir da grade da Agenda de Serviços.
// Mesma regra do app do aluno: horários sem aluno, por dia da semana ou data,
// excluindo os já reservados (profissional + data + início), os do passado
// e os horários fixos com exceção marcada naquela data.

export type HorarioGrade = {
  id: string;
  horario_inicio: string;
  horario_fim: string;
  dia_semana: number | null;
  data_especifica: string | null;
  profissional_id: string | null;
  local?: string | null;
};

export type Reserva = { profissional_id: string | null; data_especifica: string | null; horario_inicio: string };
export type Excecao = { agenda_id: string; data_excecao: string };

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function horariosLivresNoDia(
  dia: Date,
  grade: HorarioGrade[],
  reservas: Reserva[],
  excecoes: Excecao[],
  agora: Date = new Date(),
): HorarioGrade[] {
  const key = ymd(dia);
  const ocupados = new Set(
    reservas.filter((r) => r.data_especifica === key)
      .map((r) => `${r.profissional_id ?? ""}|${String(r.horario_inicio).slice(0, 5)}`),
  );
  const excluidos = new Set(excecoes.filter((e) => e.data_excecao === key).map((e) => e.agenda_id));
  return grade
    .filter((h) => (h.data_especifica ? h.data_especifica === key : h.dia_semana === dia.getDay()))
    .filter((h) => {
      const [hh, mm] = String(h.horario_inicio).split(":").map(Number);
      const dt = new Date(dia);
      dt.setHours(hh, mm, 0, 0);
      if (dt.getTime() <= agora.getTime()) return false;
      if (excluidos.has(h.id)) return false;
      return !ocupados.has(`${h.profissional_id ?? ""}|${String(h.horario_inicio).slice(0, 5)}`);
    })
    .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
}

/** Saldo restante depois dos horários já selecionados (null = ilimitado). */
export function saldoRestante(saldo: number, ilimitado: boolean, selecionados: number): number | null {
  if (ilimitado) return null;
  return Math.max(0, saldo - selecionados);
}

/** Pode marcar mais um horário sem passar do saldo? */
export function podeSelecionarMais(saldo: number, ilimitado: boolean, selecionados: number): boolean {
  return ilimitado || selecionados < saldo;
}
