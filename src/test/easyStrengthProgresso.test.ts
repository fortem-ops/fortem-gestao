import { describe, it, expect } from "vitest";
import {
  ES_TOTAL_SEMANAS,
  ajustarFrequenciaES,
  alvosDaSessaoES,
  cicloAtualES,
  emptyEasyStrength,
  esSlots,
  kgES,
  niveisPadraoES,
  normalizarSessoesES,
  planoES,
  semanaAtualES,
  tabelaES,
} from "@/lib/easyStrength";

describe("Easy Strength — tabela fixa", () => {
  it("repete o ciclo de 3 semanas três vezes", () => {
    [1, 4, 7].forEach((s) => expect(planoES("leve", s)).toEqual({ esquema: "2x5", pct: 70 }));
    [2, 5, 8].forEach((s) => expect(planoES("pesado", s)).toEqual({ esquema: "6x1", pct: 90 }));
    [3, 6, 9].forEach((s) => expect(planoES("medio", s)).toEqual({ esquema: "3x3", pct: 75 }));
  });

  it("tabela completa tem 9 semanas", () => {
    const t = tabelaES("medio");
    expect(t).toHaveLength(ES_TOTAL_SEMANAS);
    expect(t[1]).toEqual({ semana: 2, esquema: "5,3,2", pct: 85 });
  });

  it("kg = 1RM × % arredondado a 2,5", () => {
    expect(kgES(100, 70)).toBe(70);
    expect(kgES(102, 85)).toBe(87.5);
    expect(kgES(0, 85)).toBe(0);
  });
});

describe("Easy Strength — progresso cíclico por slot", () => {
  it("semana avança com as sessões concluídas e reinicia depois da 9ª", () => {
    expect(semanaAtualES(0)).toBe(1);
    expect(semanaAtualES(8)).toBe(9);
    expect(semanaAtualES(9)).toBe(1);
    expect(semanaAtualES(10)).toBe(2);
  });

  it("conta as voltas completas do ciclo", () => {
    expect(cicloAtualES(0)).toBe(1);
    expect(cicloAtualES(8)).toBe(1);
    expect(cicloAtualES(9)).toBe(2);
    expect(cicloAtualES(18)).toBe(3);
  });
});

describe("Easy Strength — estrutura", () => {
  it("3x/semana fixa os níveis em Leve, Pesado e Médio", () => {
    const data = emptyEasyStrength(3);
    expect(esSlots(3)).toEqual(["T1", "T2", "T3"]);
    expect(data.sessoes.map((s) => s.nivel)).toEqual(["leve", "pesado", "medio"]);
    expect(data.sessoes.every((s) => s.auxiliares.length === 2)).toBe(true);
  });

  it("2x/semana preserva os níveis escolhidos pelo professor", () => {
    const base = emptyEasyStrength(2);
    const escolhido = normalizarSessoesES(
      [
        { slot: "T1", nivel: "medio", auxiliares: base.sessoes[0].auxiliares },
        { slot: "T2", nivel: "pesado", auxiliares: base.sessoes[1].auxiliares },
      ],
      2,
    );
    expect(escolhido.map((s) => s.nivel)).toEqual(["medio", "pesado"]);
    expect(niveisPadraoES(2)).toEqual(["leve", "pesado"]);
  });

  it("trocar de 3x para 2x mantém dois slots", () => {
    const data = ajustarFrequenciaES(emptyEasyStrength(3), 2);
    expect(data.sessoes).toHaveLength(2);
    expect(data.frequencia).toBe(2);
  });

  it("todos os levantamentos usam o mesmo nível da sessão", () => {
    const data = emptyEasyStrength(3);
    data.levantamentos = [
      { levantamento: "Agachamento", rm1: 100 },
      { levantamento: "Supino", rm1: 80 },
    ];
    const alvos = alvosDaSessaoES(data, "pesado", 1);
    expect(alvos.map((a) => a.esquema)).toEqual(["5x2", "5x2"]);
    expect(alvos.map((a) => a.kg)).toEqual([85, 67.5]);
  });
});
