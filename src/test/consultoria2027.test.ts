import { describe, expect, it } from "vitest";
import { calcularVenda2027 } from "@/lib/vendas2027";

const pacote = (meses: number, valor: number) => ({
  codigo: `consultoria_2027_${meses}m`, familia: "consultoria_2027", modalidade_cobranca: "pacote", valor, periodo_meses: meses,
});
const p4 = pacote(4, 676);
const p6 = pacote(6, 894);
const mensal = { codigo: "consultoria_2027_mensal", familia: "consultoria_2027", modalidade_cobranca: "recorrencia_mensal", valor: 189, taxa_recorrencia: 24.9 };
const valores = (r: ReturnType<typeof calcularVenda2027>) => r.plano.parcelas.map((p) => p.valor);

describe("Consultoria Online 2027", () => {
  it("4 meses em 4x sem desconto = 4 x 169,00", () => {
    const r = calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 4 });
    expect(valores(r)).toEqual([169, 169, 169, 169]);
    expect(r.totalGeral).toBe(676);
  });

  it("6 meses em 6x sem desconto = 6 x 149,00", () => {
    const r = calcularVenda2027({ item: p6, forma: "cartao_parcelado", parcelas: 6 });
    expect(valores(r)).toEqual([149, 149, 149, 149, 149, 149]);
    expect(r.totalGeral).toBe(894);
  });

  it("6 meses com desconto de R$ 10,00 em 6x: sobra na última", () => {
    const r = calcularVenda2027({ item: p6, forma: "cartao_parcelado", parcelas: 6, descontoPlano: 10 });
    expect(valores(r)).toEqual([147.33, 147.33, 147.33, 147.33, 147.33, 147.35]);
    expect(r.totalGeral).toBe(884);
  });

  it("4 meses com desconto de R$ 0,01 em 3x = 3 x 225,33", () => {
    const r = calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 3, descontoPlano: 0.01 });
    expect(valores(r)).toEqual([225.33, 225.33, 225.33]);
    expect(r.totalGeral).toBe(675.99);
  });

  it("recusa parcelas acima da duração ou abaixo de 1", () => {
    expect(() => calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 5 })).toThrow();
    expect(() => calcularVenda2027({ item: p6, forma: "cartao_parcelado", parcelas: 7 })).toThrow();
    expect(() => calcularVenda2027({ item: p6, forma: "cartao_parcelado", parcelas: 0 })).toThrow();
  });

  it("recusa desconto igual, maior que o valor ou negativo", () => {
    expect(() => calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 4, descontoPlano: 676 })).toThrow();
    expect(() => calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 4, descontoPlano: 700 })).toThrow();
    expect(() => calcularVenda2027({ item: p4, forma: "cartao_parcelado", parcelas: 4, descontoPlano: -1 })).toThrow();
  });

  it("Pix à vista é uma parcela só", () => {
    const r = calcularVenda2027({ item: p6, forma: "pix_vista", parcelas: 6 });
    expect(valores(r)).toEqual([894]);
  });

  it("pacote não aceita recorrência", () => {
    expect(() => calcularVenda2027({ item: p4, forma: "recorrencia" })).toThrow();
  });

  it("Mensal R$ 189,00 com desconto de R$ 20,00: 1ª cobrança 169,00, sem taxa, um ciclo", () => {
    const r = calcularVenda2027({ item: mensal, forma: "recorrencia", descontoPlano: 20 });
    expect(valores(r)).toEqual([169]);
    expect(r.totalPlano).toBe(169);
  });
});
