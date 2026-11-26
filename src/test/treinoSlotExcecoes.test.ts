import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aplicarExcecaoNoSlot,
  proximaOcorrenciaDiaSemana,
  validarCapacidadeExcecao,
  type TreinoSlotBase,
  type TreinoSlotExcecao,
} from "@/lib/treinoSlotExcecoes";

const slotBase: TreinoSlotBase = {
  id: "slot-1",
  dia_semana: 4,
  horario_inicio: "07:00:00",
  horario_fim: "08:00:00",
  capacidade_maxima: 8,
  instrutor_id: "prof-a",
  ativo: true,
  observacoes: "Original",
  modalidade: "treino",
};

describe("treinoSlotExcecoes", () => {
  it("aplica a exceção somente quando existe para a data e preserva o modelo sem exceção", () => {
    const semExcecao = aplicarExcecaoNoSlot(slotBase, null);
    expect(semExcecao.temExcecao).toBe(false);
    expect(semExcecao.horario_inicio).toBe("07:00:00");
    expect(semExcecao.capacidade_maxima).toBe(8);
    expect(semExcecao.instrutor_id).toBe("prof-a");

    const excecao: TreinoSlotExcecao = {
      slot_id: "slot-1",
      data: "2026-11-26",
      horario_inicio: "07:30:00",
      horario_fim: "08:30:00",
      capacidade_maxima: 10,
      instrutor_id: "prof-b",
      modalidade: "corrida",
      observacoes: "Ajuste pontual",
    };
    const comExcecao = aplicarExcecaoNoSlot(slotBase, excecao);
    expect(comExcecao.temExcecao).toBe(true);
    expect(comExcecao.horario_inicio).toBe("07:30:00");
    expect(comExcecao.horario_fim).toBe("08:30:00");
    expect(comExcecao.capacidade_maxima).toBe(10);
    expect(comExcecao.instrutor_id).toBe("prof-b");
    expect(comExcecao.modalidade).toBe("corrida");
    expect(comExcecao.observacoes).toBe("Ajuste pontual");
    expect(slotBase.horario_inicio).toBe("07:00:00");
  });

  it("recusa capacidade abaixo das reservas ativas no dia", () => {
    expect(validarCapacidadeExcecao(4, 5)).toContain("5");
    expect(validarCapacidadeExcecao(0, 0)).not.toBeNull();
    expect(validarCapacidadeExcecao(5, 5)).toBeNull();
    expect(validarCapacidadeExcecao(10, 5)).toBeNull();
  });

  it("calcula a próxima ocorrência do dia da semana corretamente", () => {
    // 2026-11-26 é quinta-feira (4)
    const ref = new Date(2026, 10, 26, 10, 0, 0);
    expect(proximaOcorrenciaDiaSemana(4, ref)).toBe("2026-11-26");
    expect(proximaOcorrenciaDiaSemana(5, ref)).toBe("2026-11-27");
    expect(proximaOcorrenciaDiaSemana(1, ref)).toBe("2026-11-30");
  });

  it("migration 0302 cria treino_slot_excecoes com GRANT/RLS e aplica exceções nas funções de agendamento", () => {
    const sql = readFileSync(
      join(process.cwd(), "drizzle/migrations/0302_treino_slot_excecoes.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE public.treino_slot_excecoes");
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_slot_excecoes TO authenticated");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("fn_agendar_treino");
    expect(sql).toContain("fn_processar_horarios_fixos");
    expect(sql).toContain("COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima)");
  });
});