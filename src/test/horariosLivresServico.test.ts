import { describe, it, expect } from "vitest";
import { horariosLivresNoDia, type HorarioGrade } from "@/lib/horariosLivresServico";

const segunda = new Date(2026, 9, 26); // 26/10/2026, segunda
const agora = new Date(2026, 9, 19, 12, 0);
const grade: HorarioGrade[] = [
  { id: "a", horario_inicio: "08:00:00", horario_fim: "09:00:00", dia_semana: 1, data_especifica: null, profissional_id: "p1" },
  { id: "b", horario_inicio: "09:00:00", horario_fim: "10:00:00", dia_semana: 1, data_especifica: null, profissional_id: "p1" },
  { id: "c", horario_inicio: "10:00:00", horario_fim: "11:00:00", dia_semana: 2, data_especifica: null, profissional_id: "p1" },
];

describe("horários livres para agendar pela equipe", () => {
  it("horário já reservado não aparece", () => {
    const r = horariosLivresNoDia(segunda, grade, [{ profissional_id: "p1", data_especifica: "2026-10-26", horario_inicio: "08:00:00" }], [], agora);
    expect(r.map((h) => h.id)).toEqual(["b"]);
  });
  it("horário com exceção na data não aparece", () => {
    const r = horariosLivresNoDia(segunda, grade, [], [{ agenda_id: "b", data_excecao: "2026-10-26" }], agora);
    expect(r.map((h) => h.id)).toEqual(["a"]);
  });
  it("horário que já passou não aparece", () => {
    const r = horariosLivresNoDia(segunda, grade, [], [], new Date(2026, 9, 26, 8, 30));
    expect(r.map((h) => h.id)).toEqual(["b"]);
  });
});

import { podeSelecionarMais, saldoRestante } from "@/lib/horariosLivresServico";
describe("seleção múltipla de horários", () => {
  it("não permite passar do saldo", () => {
    expect(podeSelecionarMais(3, false, 2)).toBe(true);
    expect(podeSelecionarMais(3, false, 3)).toBe(false);
    expect(saldoRestante(3, false, 2)).toBe(1);
  });
  it("ilimitado não bloqueia", () => {
    expect(podeSelecionarMais(0, true, 10)).toBe(true);
    expect(saldoRestante(0, true, 10)).toBeNull();
  });
});
