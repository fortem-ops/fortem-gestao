import { addDays, format } from "date-fns";

export type TreinoSlotBase = {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  capacidade_maxima: number;
  instrutor_id: string | null;
  ativo?: boolean;
  observacoes?: string | null;
  modalidade?: string | null;
};

export type TreinoSlotExcecao = {
  id?: string;
  slot_id: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  capacidade_maxima: number;
  instrutor_id: string | null;
  modalidade: string;
  observacoes: string | null;
};

export type SlotComExcecao<T extends TreinoSlotBase = TreinoSlotBase> = T & {
  temExcecao: boolean;
};

export function aplicarExcecaoNoSlot<T extends TreinoSlotBase>(
  slot: T,
  excecao?: TreinoSlotExcecao | null,
): SlotComExcecao<T> {
  if (!excecao) {
    return { ...slot, temExcecao: false };
  }
  return {
    ...slot,
    horario_inicio: excecao.horario_inicio,
    horario_fim: excecao.horario_fim,
    capacidade_maxima: excecao.capacidade_maxima,
    instrutor_id: excecao.instrutor_id,
    modalidade: excecao.modalidade,
    observacoes: excecao.observacoes,
    temExcecao: true,
  };
}

export function proximaOcorrenciaDiaSemana(diaSemana: number, referencia: Date = new Date()): string {
  const diff = (diaSemana - referencia.getDay() + 7) % 7;
  return format(addDays(referencia, diff), "yyyy-MM-dd");
}

export function validarCapacidadeExcecao(novaCapacidade: number, reservasAtivas: number): string | null {
  if (!Number.isFinite(novaCapacidade) || novaCapacidade < 1) {
    return "Capacidade máxima deve ser de pelo menos 1 vaga.";
  }
  if (novaCapacidade < reservasAtivas) {
    return `Já existem ${reservasAtivas} reserva${reservasAtivas === 1 ? "" : "s"} neste dia. A capacidade não pode ser menor que ${reservasAtivas}.`;
  }
  return null;
}