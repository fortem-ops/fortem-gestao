import { describe, it, expect } from "vitest";
import { diferencaValor } from "@/lib/conciliacaoSaida";
describe("diferencaValor", () => {
  it("valores iguais dão zero", () => expect(diferencaValor(150.1, 150.1)).toBe(0));
  it("banco maior que lançado", () => expect(diferencaValor(100, 112.35)).toBe(12.35));
  it("evita erro de ponto flutuante", () => expect(diferencaValor(0.1 + 0.2, 0.3)).toBe(0));
});

import { somaCentavos } from "@/lib/conciliacaoSaida";
describe("somaCentavos", () => {
  it("soma itens de fatura sem erro de arredondamento", () => {
    expect(somaCentavos([0.1, 0.2, 2208.58])).toBe(2208.88);
  });
});

import { totalLiquidoFatura } from "@/lib/conciliacaoSaida";
describe("totalLiquidoFatura", () => {
  it("desconta estorno de R$ 154,44 da soma das compras", () => {
    expect(totalLiquidoFatura([4000, 892.43], [154.44])).toBe(4737.99);
  });
});
