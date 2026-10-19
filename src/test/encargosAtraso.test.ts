import { describe, it, expect } from "vitest";
import { calcularEncargosAtraso, mensalidadeEmAtraso } from "@/lib/encargosAtraso";

describe("encargos por atraso", () => {
  it("10 dias sem IPCA: R$ 623,90 vira R$ 638,46", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 62390, vencimento: "2027-03-10", dataCalculo: "2027-03-20", indices: { "2027-03": 0 } });
    expect(r.diasAtraso).toBe(10);
    expect(r.multa).toBe(1248);
    expect(r.juros).toBe(208);
    expect(r.total).toBe(63846);
  });

  it("45 dias com IPCA 0,75%: R$ 623,90 vira R$ 650,58", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 62390, vencimento: "2027-01-31", dataCalculo: "2027-03-17", indices: { "2027-02": 0.75, "2027-03": 0 } });
    expect(r.diasAtraso).toBe(45);
    expect(r.corrigido).toBe(62858);
    expect(r.multa).toBe(1257);
    expect(r.juros).toBe(943);
    expect(r.total).toBe(65058);
  });

  it("IPCA negativo não reduz o valor (fator mínimo 1)", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 62390, vencimento: "2027-01-31", dataCalculo: "2027-02-28", indices: { "2027-02": -0.5 } });
    expect(r.fatorIpca).toBe(1);
    expect(r.correcao).toBe(0);
    expect(r.multa).toBe(1248);
  });

  it("no dia do vencimento não há encargos", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 62390, vencimento: "2027-03-10", dataCalculo: "2027-03-10", indices: {} });
    expect(r.total).toBe(62390);
  });

  it("1 dia de atraso: multa cheia e juros de 1/30 de 1%", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 30000, vencimento: "2027-03-10", dataCalculo: "2027-03-11", indices: { "2027-03": 0 } });
    expect(r.multa).toBe(600);
    expect(r.juros).toBe(10);
  });

  it("mês não divulgado usa o último IPCA publicado", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 100000, vencimento: "2027-02-28", dataCalculo: "2027-03-31", indices: { "2027-01": 1 } });
    expect(r.meses[0].estimado).toBe(true);
    expect(r.corrigido).toBe(101000);
  });

  it("mês parcial é proporcional aos dias", () => {
    const r = calcularEncargosAtraso({ principalCentavos: 100000, vencimento: "2027-04-15", dataCalculo: "2027-04-30", indices: { "2027-04": 1.2 } });
    expect(r.corrigido).toBe(100600);
  });

  it("só mensalidade vencida e não paga entra", () => {
    expect(mensalidadeEmAtraso({ status: "inadimplente", vencimento: "2027-01-10" }, "2027-01-11")).toBe(true);
    expect(mensalidadeEmAtraso({ status: "pago", vencimento: "2027-01-10" }, "2027-02-11")).toBe(false);
    expect(mensalidadeEmAtraso({ status: "pendente", vencimento: "2027-01-10" }, "2027-01-10")).toBe(false);
  });
});
