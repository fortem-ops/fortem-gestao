import { describe, it, expect } from "vitest";
import { podeCobrarPrimeiroCiclo } from "@/lib/cobrarMensalidade";

const base = { isAdmin: true, status: "pendente", numeroCiclo: 1, formaContrato: "cartao_recorrencia", tentativas: 0 };

describe("botão Cobrar da mensalidade", () => {
  it("aparece no 1º ciclo pendente de cartão recorrente para admin", () => {
    expect(podeCobrarPrimeiroCiclo(base)).toBe(true);
  });
  it("não aparece para mensalidades seguintes", () => {
    expect(podeCobrarPrimeiroCiclo({ ...base, numeroCiclo: 2 })).toBe(false);
  });
  it("não aparece para mensalidade paga", () => {
    expect(podeCobrarPrimeiroCiclo({ ...base, status: "pago" })).toBe(false);
  });
  it("não aparece para quem não é admin", () => {
    expect(podeCobrarPrimeiroCiclo({ ...base, isAdmin: false })).toBe(false);
  });
});
