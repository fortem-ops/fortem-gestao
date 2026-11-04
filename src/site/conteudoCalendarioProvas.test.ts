import { describe, it, expect } from "vitest";
import { CALENDARIO_PROVAS_2027, ordenarProvas, partesData, provaRealizada, mensagemProva } from "./conteudoCalendarioProvas";

describe("calendário de provas 2027", () => {
  it("ordena por data", () => {
    const o = ordenarProvas([...CALENDARIO_PROVAS_2027].reverse());
    expect(o.map((p) => p.data)).toEqual(["2027-04-25", "2027-06-05", "2027-08-21", "2027-10-03"]);
  });
  it("não inventa campos opcionais", () => {
    for (const p of CALENDARIO_PROVAS_2027) expect([p.local, p.distancias, p.linkInscricao, p.observacao].every((v) => !v)).toBe(true);
  });
  it("formata dia e mês", () => expect(partesData("2027-06-05")).toEqual({ dia: "05", mes: "JUN" }));
  it("marca realizada só depois do dia", () => {
    expect(provaRealizada("2027-04-25", "2027-04-25")).toBe(false);
    expect(provaRealizada("2027-04-25", "2027-04-26")).toBe(true);
  });
  it("mensagem cita a prova", () => expect(mensagemProva("3ª NEW BALANCE")).toContain("preparação para a 3ª NEW BALANCE"));
});

import { agruparPorMes, statusProva } from "./conteudoCalendarioProvas";
describe("cards por mês", () => {
  it("agrupa só meses com prova", () => {
    expect(agruparPorMes(CALENDARIO_PROVAS_2027).map((g) => g.rotulo)).toEqual(["ABRIL 2027", "JUNHO 2027", "AGOSTO 2027", "OUTUBRO 2027"]);
  });
  it("contagem regressiva", () => {
    expect(statusProva("2027-04-25", "2027-04-15")).toBe("FALTAM 10 DIAS");
    expect(statusProva("2027-04-25", "2027-04-25")).toBe("É HOJE");
    expect(statusProva("2027-04-25", "2027-04-26")).toBe("REALIZADA");
  });
});
