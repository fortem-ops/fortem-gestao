import { describe, it, expect } from "vitest";
import {
  classificarAvaliacaoFuncional,
  classificarFrequencia,
  frequenciaBaseSemanal,
  pertenceAoEscopo,
} from "@/lib/carteiraConsultor";

const hoje = new Date("2026-06-15T12:00:00Z");

describe("classificarAvaliacaoFuncional", () => {
  it("em dia com menos de 4 meses", () => {
    expect(classificarAvaliacaoFuncional(new Date("2026-04-01"), hoje)).toBe("em_dia");
  });
  it("pendente entre 4 e 6 meses", () => {
    expect(classificarAvaliacaoFuncional(new Date("2026-01-10"), hoje)).toBe("pendente");
  });
  it("atrasada com 6 meses ou mais", () => {
    expect(classificarAvaliacaoFuncional(new Date("2025-11-01"), hoje)).toBe("atrasada");
  });
  it("atrasada quando nunca avaliado", () => {
    expect(classificarAvaliacaoFuncional(null, hoje)).toBe("atrasada");
  });
});

describe("classificarFrequencia", () => {
  it("Livre usa base de 3x por semana", () => {
    expect(frequenciaBaseSemanal(5)).toBe(3);
    expect(frequenciaBaseSemanal(2)).toBe(2);
    expect(frequenciaBaseSemanal(0)).toBeNull();
  });
  it("assíduo a partir de 75% do previsto", () => {
    expect(classificarFrequencia({ sessoes4Semanas: 9, frequenciaSemanal: 3, temAgendamentos: true })).toBe("assiduo");
  });
  it("irregular abaixo de 75%", () => {
    expect(classificarFrequencia({ sessoes4Semanas: 5, frequenciaSemanal: 3, temAgendamentos: true })).toBe("irregular");
  });
  it("sem dados quando não há frequência contratada", () => {
    expect(classificarFrequencia({ sessoes4Semanas: 4, frequenciaSemanal: null, temAgendamentos: true })).toBe("sem_dados");
  });
  it("sem dados quando não há agendamentos nem sessões", () => {
    expect(classificarFrequencia({ sessoes4Semanas: 0, frequenciaSemanal: 3, temAgendamentos: false })).toBe("sem_dados");
  });
});

describe("pertenceAoEscopo", () => {
  it("inclui quando é professor responsável", () => {
    expect(pertenceAoEscopo({ responsavel_id: "u1", consultor_id: null }, "u1")).toBe(true);
  });
  it("inclui quando é consultor", () => {
    expect(pertenceAoEscopo({ responsavel_id: "u2", consultor_id: "u1" }, "u1")).toBe(true);
  });
  it("inclui quando é os dois", () => {
    expect(pertenceAoEscopo({ responsavel_id: "u1", consultor_id: "u1" }, "u1")).toBe(true);
  });
  it("exclui quando não é nenhum", () => {
    expect(pertenceAoEscopo({ responsavel_id: "u2", consultor_id: "u3" }, "u1")).toBe(false);
    expect(pertenceAoEscopo({ responsavel_id: "u1" }, null)).toBe(false);
  });
});
