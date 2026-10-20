import { describe, it, expect } from "vitest";
import { treinoDoDia531, variacao531, semanaAtual531 } from "@/pages/portal/PortalWorkouts";

describe("treino do dia 5-3-1", () => {
  it("sem registro abre o Treino 1", () => {
    expect(treinoDoDia531([1, 2, 3], 1, [])).toBe(1);
  });
  it("abre o primeiro treino não concluído da semana escolhida", () => {
    const s = [{ variacao: variacao531(2, 1), concluido_em: "x" }];
    expect(treinoDoDia531([1, 2, 3], 2, s)).toBe(2);
    expect(treinoDoDia531([1, 2, 3], 1, s)).toBe(1);
  });
});

describe("semana atual 5-3-1", () => {
  const ordens = [1, 2, 3];
  const feitas = (semana: number) =>
    ordens.map((o) => ({ variacao: variacao531(semana, o), concluido_em: "x" }));

  it("sem sessões abre na Semana 1", () => {
    expect(semanaAtual531(ordens, [])).toEqual({ semana: 1, concluida: false });
  });

  it("semana 1 incompleta mantém a Semana 1", () => {
    const s = [{ variacao: variacao531(1, 1), concluido_em: "x" }];
    expect(semanaAtual531(ordens, s)).toEqual({ semana: 1, concluida: false });
  });

  it("semana 1 completa abre a Semana 2", () => {
    expect(semanaAtual531(ordens, feitas(1))).toEqual({ semana: 2, concluida: false });
  });

  it("semanas 1 a 3 completas abrem a Semana 4", () => {
    expect(semanaAtual531(ordens, [...feitas(1), ...feitas(2), ...feitas(3)])).toEqual({
      semana: 4,
      concluida: false,
    });
  });

  it("todas as semanas completas retornam onda concluída", () => {
    const s = [...feitas(1), ...feitas(2), ...feitas(3), ...feitas(4)];
    expect(semanaAtual531(ordens, s)).toEqual({ semana: 4, concluida: true });
  });

  it("sessões com concluido_em nulo não contam", () => {
    const s = ordens.map((o) => ({ variacao: variacao531(1, o), concluido_em: null }));
    expect(semanaAtual531(ordens, s)).toEqual({ semana: 1, concluida: false });
  });
});

import { nomeExercicioAluno531 } from "@/pages/portal/PortalWorkouts";
describe("nome do exercício para o aluno 5-3-1", () => {
  it.each([
    ["11- Remada Curvada com Barra", "Remada Curvada com Barra"],
    ["03. CARs - Rotação interna", "CARs - Rotação interna"],
    ["01- Desassociação quadril", "Desassociação quadril"],
    ["F1- Isom. flexores de quadril", "Isom. flexores de quadril"],
    ["1- Passada Simples", "Passada Simples"],
    ["3- Supino Alternado com Halteres", "Supino Alternado com Halteres"],
  ])("remove prefixo de %s", (a, b) => expect(nomeExercicioAluno531(a)).toBe(b));
  it.each(["90/90 de quadril", "21s de bíceps", "Supino"])("mantém %s", (a) =>
    expect(nomeExercicioAluno531(a)).toBe(a));
  it("vazio vira Exercício sem nome", () => expect(nomeExercicioAluno531("")).toBe("Exercício sem nome"));
});
