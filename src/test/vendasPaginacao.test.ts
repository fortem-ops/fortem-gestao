import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE,
  calcRange,
  calcTotalPages,
  clampPage,
  hasPrevPage,
  hasNextPage,
} from "@/lib/vendas-paginacao";

describe("calcRange", () => {
  it("página 1 começa em 0", () => {
    expect(calcRange(1)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
  });

  it("página 2 começa em PAGE_SIZE", () => {
    expect(calcRange(2)).toEqual({ from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 });
  });

  it("página 3 está correta", () => {
    expect(calcRange(3)).toEqual({ from: 100, to: 149 });
  });

  it("range sempre tem exatamente PAGE_SIZE itens", () => {
    for (const p of [1, 2, 5, 10, 100]) {
      const { from, to } = calcRange(p);
      expect(to - from).toBe(PAGE_SIZE - 1);
    }
  });
});

describe("calcTotalPages", () => {
  it("0 registros retorna 1 (página mínima)", () => {
    expect(calcTotalPages(0)).toBe(1);
  });

  it("exatamente PAGE_SIZE registros = 1 página", () => {
    expect(calcTotalPages(PAGE_SIZE)).toBe(1);
  });

  it("PAGE_SIZE + 1 registros = 2 páginas", () => {
    expect(calcTotalPages(PAGE_SIZE + 1)).toBe(2);
  });

  it("200 registros com PAGE_SIZE=50 = 4 páginas", () => {
    expect(calcTotalPages(200)).toBe(4);
  });

  it("201 registros = 5 páginas", () => {
    expect(calcTotalPages(201)).toBe(5);
  });

  it("1 registro = 1 página", () => {
    expect(calcTotalPages(1)).toBe(1);
  });
});

describe("clampPage", () => {
  it("página 0 é corrigida para 1", () => {
    expect(clampPage(0, 5)).toBe(1);
  });

  it("página negativa é corrigida para 1", () => {
    expect(clampPage(-3, 5)).toBe(1);
  });

  it("página acima do total é limitada ao total", () => {
    expect(clampPage(10, 5)).toBe(5);
  });

  it("página válida no meio não é alterada", () => {
    expect(clampPage(3, 5)).toBe(3);
  });

  it("página 1 com total 1 retorna 1", () => {
    expect(clampPage(1, 1)).toBe(1);
  });
});

describe("hasPrevPage", () => {
  it("página 1 não tem anterior", () => {
    expect(hasPrevPage(1)).toBe(false);
  });

  it("página 2 tem anterior", () => {
    expect(hasPrevPage(2)).toBe(true);
  });

  it("página 10 tem anterior", () => {
    expect(hasPrevPage(10)).toBe(true);
  });
});

describe("hasNextPage", () => {
  it("na última página não tem próxima", () => {
    expect(hasNextPage(5, 5)).toBe(false);
  });

  it("antes da última tem próxima", () => {
    expect(hasNextPage(4, 5)).toBe(true);
  });

  it("página 1 de 1 não tem próxima", () => {
    expect(hasNextPage(1, 1)).toBe(false);
  });

  it("página 1 de 3 tem próxima", () => {
    expect(hasNextPage(1, 3)).toBe(true);
  });
});
