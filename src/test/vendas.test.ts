import { describe, it, expect } from "vitest";
import { calcStats, calcPorPlano, formatBrl } from "@/lib/vendas-calc";

describe("calcStats", () => {
  it("retorna zeros para array vazio", () => {
    expect(calcStats([])).toEqual({ total: 0, qtd: 0, ticket: 0, cancelados: 0 });
  });

  it("exclui cancelados do total e ticket", () => {
    const s = calcStats([
      { valor: 100, status: "pago" },
      { valor: 200, status: "pago" },
      { valor: 999, status: "cancelado" },
    ]);
    expect(s.total).toBe(300);
    expect(s.qtd).toBe(2);
    expect(s.ticket).toBe(150);
    expect(s.cancelados).toBe(1);
  });

  it("ticket médio = total / qtd", () => {
    const s = calcStats([
      { valor: 300, status: "pago" },
      { valor: 600, status: "pago" },
      { valor: 900, status: "pago" },
    ]);
    expect(s.ticket).toBe(600);
  });
});

describe("calcPorPlano", () => {
  it("agrupa e ordena por valor decrescente", () => {
    const r = calcPorPlano([
      { valor: 100, plano_tipo: "Mensal" },
      { valor: 500, plano_tipo: "Anual" },
      { valor: 200, plano_tipo: "Mensal" },
      { valor: 50, item: "Avulso" },
    ]);
    expect(r.map((x) => x.plano)).toEqual(["Anual", "Mensal", "Avulso"]);
    expect(r[1].valor).toBe(300);
    expect(r[1].qtd).toBe(2);
  });

  it("ignora cancelados", () => {
    const r = calcPorPlano([
      { valor: 100, plano_tipo: "Mensal", status: "pago" },
      { valor: 9999, plano_tipo: "Mensal", status: "cancelado" },
    ]);
    expect(r[0].valor).toBe(100);
    expect(r[0].qtd).toBe(1);
  });

  it("usa item como fallback quando não há plano_tipo", () => {
    const r = calcPorPlano([{ valor: 80, item: "Personal" }]);
    expect(r[0].plano).toBe("Personal");
  });
});

describe("formatBrl", () => {
  it("formata inteiro", () => {
    expect(formatBrl(1500).replace(/\s/g, " ")).toBe("R$ 1.500,00");
  });

  it("formata decimal", () => {
    expect(formatBrl(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });

  it("formata zero", () => {
    expect(formatBrl(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});
