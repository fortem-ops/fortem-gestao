import { describe, expect, it } from "vitest";
import {
  MD_BLOCOS,
  MD_TOTAL_SEMANAS,
  normalizarOrdemMD,
  planoMD,
  semanaAtualMD,
  tabelaMD,
} from "@/lib/mileDeepShared";
import { MD1_FAIXAS } from "@/lib/mileDeep1RM";
import { MD5_FAIXAS } from "@/lib/mileDeep5RM";

describe("Quality a Mile Deep — ciclo de 12 semanas", () => {
  it("sobe uma série por semana dentro do bloco", () => {
    const ordem = normalizarOrdemMD(["b5", "b3", "b2"]);
    expect([1, 2, 3, 4].map((s) => planoMD(ordem, s, MD1_FAIXAS).esquema)).toEqual([
      "5x5",
      "6x5",
      "7x5",
      "8x5",
    ]);
    expect(planoMD(ordem, 5, MD1_FAIXAS).esquema).toBe("10x3");
    expect(planoMD(ordem, 12, MD1_FAIXAS).esquema).toBe("15x2");
  });

  it("respeita a ordem escolhida pelo professor", () => {
    const ordem = normalizarOrdemMD(["b2", "b5", "b3"]);
    expect(planoMD(ordem, 1, MD5_FAIXAS).bloco.id).toBe("b2");
    expect(planoMD(ordem, 5, MD5_FAIXAS).bloco.id).toBe("b5");
    expect(planoMD(ordem, 9, MD5_FAIXAS).bloco.id).toBe("b3");
  });

  it("usa as faixas de % de cada variante", () => {
    const ordem = normalizarOrdemMD(["b5", "b3", "b2"]);
    expect(planoMD(ordem, 1, MD1_FAIXAS).faixaLabel).toBe("60-80%");
    expect(planoMD(ordem, 1, MD5_FAIXAS).faixaLabel).toBe("60-95%");
    expect(planoMD(ordem, 12, MD5_FAIXAS).faixaLabel).toBe("75-95%");
  });

  it("reinicia o ciclo depois da semana 12", () => {
    expect(semanaAtualMD(0)).toBe(1);
    expect(semanaAtualMD(11)).toBe(12);
    expect(semanaAtualMD(12)).toBe(1);
    expect(semanaAtualMD(25)).toBe(2);
  });

  it("mantém o NL declarado de cada bloco", () => {
    expect(MD_BLOCOS.b5.series.reduce((a, s) => a + s * 5, 0)).toBe(MD_BLOCOS.b5.nl);
    expect(MD_BLOCOS.b3.series.reduce((a, s) => a + s * 3, 0)).toBe(MD_BLOCOS.b3.nl);
    expect(MD_BLOCOS.b2.series.reduce((a, s) => a + s * 2, 0)).toBe(MD_BLOCOS.b2.nl);
  });

  it("gera a tabela completa de 12 semanas", () => {
    expect(tabelaMD(["b5", "b3", "b2"], MD1_FAIXAS)).toHaveLength(MD_TOTAL_SEMANAS);
  });
});
