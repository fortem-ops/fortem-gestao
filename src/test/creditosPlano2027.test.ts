import { describe, it, expect } from "vitest";
import { creditoCarteira } from "@/lib/creditosPlano2027";

describe("creditoCarteira", () => {
  it("Power 2027 com 1 Avaliação Funcional não usada mostra 1 disponível", () => {
    const r = creditoCarteira(
      [{ atividade: "Avaliação Funcional", quantidade_inicial: 1, quantidade_usada: 0, ativo: true, data_validade: "2027-11-03" }],
      "Avaliação Funcional", "2026-11-03");
    expect(r.total).toBe(1);
    expect(r.total - r.usado).toBe(1);
  });
  it("ignora crédito vencido ou inativo", () => {
    const r = creditoCarteira([
      { atividade: "Avaliação Funcional", quantidade_inicial: 1, quantidade_usada: 0, ativo: false, data_validade: null },
      { atividade: "Avaliação Funcional", quantidade_inicial: 1, quantidade_usada: 0, ativo: true, data_validade: "2026-01-01" },
    ], "Avaliação Funcional", "2026-11-03");
    expect(r.total).toBe(0);
  });
});
