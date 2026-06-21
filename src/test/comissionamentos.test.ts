import { describe, it, expect } from "vitest";
import { calcComissao, calcComissaoTotal, calcRanking } from "@/lib/comissoes-calc";

describe("calcComissao", () => {
  it("10% de 1000 = 100", () => {
    expect(calcComissao(1000, 10)).toBe(100);
  });

  it("0% retorna 0", () => {
    expect(calcComissao(1000, 0)).toBe(0);
  });

  it("arredonda para 2 casas decimais", () => {
    expect(calcComissao(33.33, 10)).toBe(3.33);
  });
});

describe("calcComissaoTotal", () => {
  it("soma comissões ignorando cancelados", () => {
    const total = calcComissaoTotal(
      [
        { valor: 1000, status: "pago" },
        { valor: 500, status: "pago" },
        { valor: 9999, status: "cancelado" },
      ],
      10,
    );
    expect(total).toBe(150);
  });

  it("array vazio retorna 0", () => {
    expect(calcComissaoTotal([], 10)).toBe(0);
  });
});

describe("calcRanking", () => {
  it("ordena por totalVendas desc", () => {
    const r = calcRanking([
      { nome: "A", totalVendas: 100 },
      { nome: "B", totalVendas: 500 },
      { nome: "C", totalVendas: 250 },
    ]);
    expect(r.map((x) => x.nome)).toEqual(["B", "C", "A"]);
  });

  it("não muta o array original", () => {
    const original = [
      { nome: "A", totalVendas: 100 },
      { nome: "B", totalVendas: 500 },
    ];
    calcRanking(original);
    expect(original[0].nome).toBe("A");
  });
});
