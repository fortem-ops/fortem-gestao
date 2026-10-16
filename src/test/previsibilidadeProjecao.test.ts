import { describe, it, expect } from "vitest";
import { valorRenovacaoProjetada, somaProjecaoJanela } from "@/lib/previsibilidadeProjecao";

describe("projeção de previsibilidade", () => {
  it("contrato de R$ 400/mês com taxa de 50% gera R$ 200/mês", () => {
    expect(valorRenovacaoProjetada(400, 0.5)).toBe(200);
  });

  it("janela de 30 dias a partir de 16/10 só soma novembro", () => {
    const meses = [
      { mes: "2026-10", renovacao_liquido: 999, vendas_novas_liquido: 0 },
      { mes: "2026-11", renovacao_liquido: 100, vendas_novas_liquido: 50 },
      { mes: "2026-12", renovacao_liquido: 100, vendas_novas_liquido: 50 },
    ];
    expect(somaProjecaoJanela(meses, "2026-10-16", 30)).toBe(150);
  });
});
