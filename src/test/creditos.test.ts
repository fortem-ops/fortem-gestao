import { describe, it, expect } from "vitest";
import { creditoDisponivel, creditoExpirado, creditoAtivo } from "@/lib/creditos-calc";
import { saldoTotalPorAtividade, saldoDetalhadoPorAtividade } from "@/lib/creditosServicos";

describe("creditoDisponivel", () => {
  it("ilimitado retorna Infinity", () => {
    expect(creditoDisponivel({ ilimitado: true, quantidade_inicial: 0, quantidade_usada: 0 })).toBe(Infinity);
  });

  it("calcula inicial - usado", () => {
    expect(creditoDisponivel({ quantidade_inicial: 10, quantidade_usada: 3 })).toBe(7);
  });

  it("zero quando totalmente usado", () => {
    expect(creditoDisponivel({ quantidade_inicial: 5, quantidade_usada: 5 })).toBe(0);
  });
});

describe("creditoExpirado", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("data futura não expirado", () => {
    expect(creditoExpirado({ data_validade: "2026-12-31" }, now)).toBe(false);
  });

  it("data passada expirado", () => {
    expect(creditoExpirado({ data_validade: "2025-01-01" }, now)).toBe(true);
  });

  it("sem data_validade nunca expira", () => {
    expect(creditoExpirado({ data_validade: null }, now)).toBe(false);
  });
});

describe("creditoAtivo", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("ativo + não expirado = true", () => {
    expect(creditoAtivo({ ativo: true, data_validade: "2026-12-31" }, now)).toBe(true);
  });

  it("inativo = false", () => {
    expect(creditoAtivo({ ativo: false, data_validade: "2026-12-31" }, now)).toBe(false);
  });

  it("ativo mas expirado = false", () => {
    expect(creditoAtivo({ ativo: true, data_validade: "2025-01-01" }, now)).toBe(false);
  });

  it("ativo sem validade = true", () => {
    expect(creditoAtivo({ ativo: true, data_validade: null }, now)).toBe(true);
  });
});

describe("saldoTotalPorAtividade — ledger como fonte única", () => {
  const consumos = [
    { tipo_servico: "Consultas Reabilitação", tipo_registro: "uso_manual", quantidade: 1, agenda_id: null },
  ];
  const planoServicos = ["2 Consultas Reabilitação", "1 Avaliação Funcional"];

  it("não soma plano + ledger para a mesma atividade", () => {
    const map = saldoTotalPorAtividade(planoServicos, consumos, [
      { atividade: "Reabilitação", quantidade_inicial: 2, quantidade_usada: 1, ilimitado: false },
    ]);
    expect(map["Reabilitação"].saldo).toBe(1);
  });

  it("usa o plano como fallback quando não há crédito no ledger", () => {
    const map = saldoTotalPorAtividade(planoServicos, consumos, []);
    expect(map["Reabilitação"].saldo).toBe(1);
    expect(map["Avaliação Funcional"].saldo).toBe(1);
  });
});

describe("saldoDetalhadoPorAtividade — plano + avulso", () => {
  // Caso real: plano Pro com 2 Consultas Reabilitação sem consumo + venda avulsa de 3 (1 usada)
  const planoServicos = ["2 Consultas Reabilitação", "2 Avaliação Funcional"];

  it("soma plano e avulso quando o ledger é de origem serviço", () => {
    const map = saldoDetalhadoPorAtividade(planoServicos, [], [
      {
        atividade: "Reabilitação",
        quantidade_inicial: 3,
        quantidade_usada: 1,
        ilimitado: false,
        origem_tipo: "servico",
      },
    ]);
    expect(map["Reabilitação"].saldoPlano).toBe(2);
    expect(map["Reabilitação"].saldoAvulso).toBe(2);
  });

  it("não soma o plano quando o ledger já é de origem plano", () => {
    const map = saldoDetalhadoPorAtividade(planoServicos, [], [
      {
        atividade: "Reabilitação",
        quantidade_inicial: 2,
        quantidade_usada: 1,
        ilimitado: false,
        origem_tipo: "plano",
      },
    ]);
    expect(map["Reabilitação"].saldoPlano).toBe(1);
    expect(map["Reabilitação"].saldoAvulso).toBe(0);
  });

  it("só plano quando não há ledger", () => {
    const map = saldoDetalhadoPorAtividade(planoServicos, [], []);
    expect(map["Reabilitação"]).toEqual({ saldoPlano: 2, saldoAvulso: 0, ilimitado: false });
    expect(map["Avaliação Funcional"].saldoPlano).toBe(2);
  });

  it("só avulso quando não há serviços no plano", () => {
    const map = saldoDetalhadoPorAtividade([], [], [
      { atividade: "Nutrição", quantidade_inicial: 5, quantidade_usada: 2, origem_tipo: "servico" },
    ]);
    expect(map["Nutrição"]).toEqual({ saldoPlano: 0, saldoAvulso: 3, ilimitado: false });
  });

  it("desconta consumos do plano e marca ilimitado do ledger", () => {
    const map = saldoDetalhadoPorAtividade(
      planoServicos,
      [{ tipo_servico: "Consultas Reabilitação", tipo_registro: "uso_manual", quantidade: 1, agenda_id: null }],
      [{ atividade: "Treino", ilimitado: true, origem_tipo: "plano" }],
    );
    expect(map["Reabilitação"].saldoPlano).toBe(1);
    expect(map["Treino"].ilimitado).toBe(true);
  });
});
