import { describe, it, expect } from "vitest";
import { calcularVenda2027 } from "@/lib/vendas2027";
import { modoPagamentoTela } from "@/lib/planosPagamentoTela";

const start2x = { familia: "start_2027", modalidade_cobranca: "recorrencia_mensal", valor: 499, taxa_recorrencia: 24.9 };
const power2xMensal = { familia: "power_2027", modalidade_cobranca: "recorrencia_mensal", valor: 429, taxa_recorrencia: 24.9 };
const power2xAnual = { familia: "power_2027", modalidade_cobranca: "anual", valor: 5148, taxa_recorrencia: 0 };

describe("cálculo R2", () => {
  it("Start = 1 cobrança mensal no preço do catálogo, sem a taxa de recorrência", () => {
    const r = calcularVenda2027({ item: start2x, forma: "recorrencia" });
    expect(r.plano.parcelas).toHaveLength(1);
    expect(r.plano.parcelas[0].valor).toBe(499);
    expect(r.totalPlano).toBe(499);
  });
  it("Start não aceita forma diferente de recorrência", () => {
    expect(() => calcularVenda2027({ item: start2x, forma: "pix_vista" })).toThrow();
    expect(() => calcularVenda2027({ item: start2x, forma: "cartao_parcelado", parcelas: 12 })).toThrow();
  });
  it("Power 2x recorrência = 12 mensalidades de R$ 453,90", () => {
    const r = calcularVenda2027({ item: power2xMensal, forma: "recorrencia" });
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.plano.parcelas.every((p) => p.valor === 453.9)).toBe(true);
    expect(r.totalPlano).toBeCloseTo(5446.8, 2);
  });
  it("Power anual 12x e Pix inalterados", () => {
    const c = calcularVenda2027({ item: power2xAnual, forma: "cartao_parcelado", parcelas: 12 });
    expect(c.plano.parcelas).toHaveLength(12);
    expect(c.plano.parcelas[0].valor).toBe(429);
    const p = calcularVenda2027({ item: power2xAnual, forma: "pix_vista" });
    expect(p.plano.parcelas).toHaveLength(1);
    expect(p.totalPlano).toBe(5148);
  });
});

describe("tela de pagamento R2", () => {
  it("recorrência pública (sem simulação) cai em contato com a equipe", () => {
    expect(modoPagamentoTela("recorrencia", { cartao_a_combinar: true })).toBe("combinar");
    expect(modoPagamentoTela("recorrencia", {})).toBe("combinar");
  });
  it("recorrência nunca abre o formulário de cartão real, nem com cartao_real ligado", () => {
    expect(modoPagamentoTela("recorrencia", { cartao_real: true })).toBe("combinar");
  });
  it("recorrência em simulação/prévia admin segue a prévia", () => {
    expect(modoPagamentoTela("recorrencia", { cartao_simulado: true })).toBe("recorrencia_previa");
  });
  it("cartão parcelado e Pix mantêm o comportamento", () => {
    expect(modoPagamentoTela("cartao_parcelado", { cartao_real: true })).toBe("cartao");
    expect(modoPagamentoTela("cartao_parcelado", { cartao_a_combinar: true })).toBe("combinar");
    expect(modoPagamentoTela("pix_vista", { cartao_a_combinar: true })).toBe("pix");
  });
});
