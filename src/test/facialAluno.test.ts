import { describe, it, expect } from "vitest";
import { estadoFacial, ehMenor, rotuloPassagem, dataPassagem } from "@/lib/facialAluno";

const hoje = new Date("2026-10-21T12:00:00-03:00");

describe("reconhecimento facial no app do aluno", () => {
  it("sem data de nascimento conta como menor", () => {
    expect(ehMenor(null, hoje)).toBe(true);
  });
  it("17 anos é menor e 18 anos não é", () => {
    expect(ehMenor("2008-10-22", hoje)).toBe(true);
    expect(ehMenor("2008-10-21", hoje)).toBe(false);
  });
  it("credencial removida volta para não cadastrado", () => {
    expect(estadoFacial("removida", "1990-01-01", hoje)).toBe("nao_cadastrado");
  });
  it("menor com facial ativa vê o acompanhamento", () => {
    expect(estadoFacial("ativa", "2015-01-01", hoje)).toBe("acompanhamento");
    expect(estadoFacial(null, "2015-01-01", hoje)).toBe("menor");
  });
  it("sem check-in facial gravado não promete presença confirmada", () => {
    expect(rotuloPassagem("presenca_confirmada", { horario_inicio: "07:00:00", checkin_origem: null })).toBe("Entrada registrada");
    expect(rotuloPassagem("presenca_confirmada", { horario_inicio: "07:00:00", checkin_origem: "facial" })).toBe("Presença confirmada · Treino das 07:00");
    expect(rotuloPassagem("sem_treino_agendado", null)).toBe("Entrada registrada · sem treino agendado");
  });
  it("formata hoje e dias anteriores", () => {
    expect(dataPassagem("2026-10-21T07:03:00-03:00", hoje)).toBe("Hoje, 07:03");
    expect(dataPassagem("2026-10-19T18:12:00-03:00", hoje)).toBe("Segunda, 19/10, 18:12");
  });
});
