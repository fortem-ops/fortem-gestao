import { describe, expect, it } from "vitest";
import { calcularValoresContrato, duracaoRealContrato } from "@/lib/contratoValores";

const contrato = {
  valor_cobrado: 399,
  parcelas: 1,
  forma_pagamento: "pix_automatico",
  data_inicio: "2026-01-15",
  data_fim: "2027-01-15",
  vigencia_tipo: "anual",
};

describe("calcularValoresContrato", () => {
  it("calcula recorrência pela duração real, sem depender do tipo do plano", () => {
    expect(calcularValoresContrato(contrato)).toMatchObject({
      total: 4788,
      parcela: 399,
      recorrente: true,
      meses: 12,
    });
  });

  it("prioriza total e parcelas da venda tradicional vinculada", () => {
    const valores = calcularValoresContrato(
      { ...contrato, valor_cobrado: 4908, forma_pagamento: "pendente" },
      { valor_final: 4908, parcelas: 4, tipo_cobranca: null },
    );
    expect(valores).toMatchObject({ total: 4908, parcela: 1227, recorrente: false, quantidadeParcelas: 4 });
  });

  it("preserva venda tradicional com desconto integral", () => {
    const valores = calcularValoresContrato(
      { ...contrato, valor_cobrado: 5988, forma_pagamento: "pendente" },
      { valor_final: 0, parcelas: 1, tipo_cobranca: "tradicional" },
    );
    expect(valores.total).toBe(0);
    expect(valores.parcela).toBe(0);
  });

  it("usa valor total do contrato no fallback tradicional", () => {
    const valores = calcularValoresContrato({ ...contrato, valor_cobrado: 3588, forma_pagamento: "pendente" });
    expect(valores).toMatchObject({ total: 3588, parcela: 3588, recorrente: false });
  });

  it("obtém a duração pelas datas, inclusive quando difere do rótulo de vigência", () => {
    expect(duracaoRealContrato({ ...contrato, data_inicio: "2026-05-11", data_fim: "2026-10-21" })).toBe(5);
  });
});