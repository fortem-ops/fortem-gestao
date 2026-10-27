import { describe, expect, it } from "vitest";
import { totalFesta, valorPagoFestaCorreto } from "../../supabase/functions/_shared/festa-valor";

describe("preço da festa no servidor", () => {
  it("1 pessoa = R$ 75", () => expect(totalFesta(0)).toBe(7500));
  it("2 pessoas = R$ 150", () => expect(totalFesta(1)).toBe(15000));
  it("4 pessoas = R$ 300", () => expect(totalFesta(3)).toBe(30000));
  it("Equipe10 validado zera todos", () => expect(totalFesta(3, true)).toBe(0));
  it("webhook/conciliação aceitam exatamente R$ 150 para duas pessoas", () => {
    expect(valorPagoFestaCorreto("150.00", totalFesta(1))).toBe(true);
    expect(valorPagoFestaCorreto("160.00", totalFesta(1))).toBe(false);
    expect(valorPagoFestaCorreto("149.99", totalFesta(1))).toBe(false);
  });
  it("pagamento histórico usa o valor registrado sem reajuste", () => {
    expect(valorPagoFestaCorreto("70.00", 7000)).toBe(true);
    expect(valorPagoFestaCorreto("75.00", 7000)).toBe(false);
  });
  it("voucher R$ 20 por pessoa: 3 pessoas = R$ 165", () => expect(totalFesta(2, false, 2000)).toBe(16500));
  it("desconto maior que R$ 75 não fica negativo", () => expect(totalFesta(1, false, 9000)).toBe(0));
});
