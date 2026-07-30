import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calcRescisao,
  calcMesAtual,
  calcCreditosPorFrequencia,
  calcPercentualMulta,
  calcPercentualRestituicao,
  calcValorServicos,
  LABEL_PLANO,
  LABEL_PAGAMENTO,
  TRANCAMENTO_MAXIMO,
  type Contrato,
  type ServicoUtilizado,
} from "../contratos-calc";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cria uma data ISO no passado, N meses atrás */
function dataHaMeses(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

const BASE_CONTRATO_RECORRENCIA: Contrato = {
  id: "test-id",
  plano_tipo: "start_plus",
  vigencia_tipo: "anual",
  forma_pagamento: "cartao_recorrencia",
  data_inicio: dataHaMeses(5),
  data_fim: null,
  valor_base: 400,
  valor_cobrado: 420,
  taxa_recorrencia: 20,
  parcelas: 1,
  status: "ativo",
  creditos_total: 156,
};

const BASE_CONTRATO_PARCELADO: Contrato = {
  ...BASE_CONTRATO_RECORRENCIA,
  forma_pagamento: "cartao_parcelado",
  parcelas: 12,
  valor_cobrado: 400,
  taxa_recorrencia: 0,
};

const SEM_SERVICOS: ServicoUtilizado[] = [];
const COM_NUTRICAO: ServicoUtilizado[] = [
  { tipo: "nutricao", utilizado: true },
  { tipo: "fisioterapia", utilizado: false },
];
const COM_FISIO: ServicoUtilizado[] = [
  { tipo: "nutricao", utilizado: false },
  { tipo: "fisioterapia", utilizado: true },
];
const COM_AMBOS: ServicoUtilizado[] = [
  { tipo: "nutricao", utilizado: true },
  { tipo: "fisioterapia", utilizado: true },
];

// ─── calcMesAtual ────────────────────────────────────────────────────────────

describe("calcMesAtual", () => {
  it("retorna 1 quando o contrato iniciou este mês", () => {
    const hoje = new Date().toISOString().split("T")[0];
    expect(calcMesAtual(hoje)).toBe(1);
  });

  it("retorna 6 quando o contrato iniciou há 5 meses", () => {
    expect(calcMesAtual(dataHaMeses(5))).toBe(6);
  });

  it("retorna 12 quando o contrato iniciou há 11 meses", () => {
    expect(calcMesAtual(dataHaMeses(11))).toBe(12);
  });

  it("nunca retorna mais que 12 (contratos vencidos)", () => {
    expect(calcMesAtual(dataHaMeses(15))).toBe(12);
  });

  it("nunca retorna menos que 1", () => {
    // data futura (edge case)
    const futuro = new Date();
    futuro.setMonth(futuro.getMonth() + 2);
    expect(calcMesAtual(futuro.toISOString().split("T")[0])).toBeGreaterThanOrEqual(1);
  });
});

// ─── calcPercentualMulta ─────────────────────────────────────────────────────

describe("calcPercentualMulta (recorrência)", () => {
  it("mês 1 → 25%", () => expect(calcPercentualMulta(1)).toBe(25));
  it("mês 4 → 25%", () => expect(calcPercentualMulta(4)).toBe(25));
  it("mês 5 → 20%", () => expect(calcPercentualMulta(5)).toBe(20));
  it("mês 6 → 20%", () => expect(calcPercentualMulta(6)).toBe(20));
  it("mês 7 → 15%", () => expect(calcPercentualMulta(7)).toBe(15));
  it("mês 12 → 15%", () => expect(calcPercentualMulta(12)).toBe(15));
});

// ─── calcPercentualRestituicao ────────────────────────────────────────────────

describe("calcPercentualRestituicao (parcelado)", () => {
  it("mês 1 → 75%", () => expect(calcPercentualRestituicao(1)).toBe(75));
  it("mês 4 → 75%", () => expect(calcPercentualRestituicao(4)).toBe(75));
  it("mês 5 → 80%", () => expect(calcPercentualRestituicao(5)).toBe(80));
  it("mês 6 → 80%", () => expect(calcPercentualRestituicao(6)).toBe(80));
  it("mês 7 → 85%", () => expect(calcPercentualRestituicao(7)).toBe(85));
  it("mês 12 → 85%", () => expect(calcPercentualRestituicao(12)).toBe(85));
});

// ─── calcValorServicos ────────────────────────────────────────────────────────

describe("calcValorServicos", () => {
  it("sem serviços → R$ 0", () => {
    expect(calcValorServicos(SEM_SERVICOS)).toBe(0);
  });

  it("só nutrição utilizada → R$ 300", () => {
    expect(calcValorServicos(COM_NUTRICAO)).toBe(300);
  });

  it("só fisioterapia utilizada → R$ 150", () => {
    expect(calcValorServicos(COM_FISIO)).toBe(150);
  });

  it("ambos utilizados → R$ 450", () => {
    expect(calcValorServicos(COM_AMBOS)).toBe(450);
  });

  it("Max: 5 nutri + 5 fisio → R$ 2.250", () => {
    const max: ServicoUtilizado[] = [
      ...Array(5).fill({ tipo: "nutricao" as const, utilizado: true }),
      ...Array(5).fill({ tipo: "fisioterapia" as const, utilizado: true }),
    ];
    expect(calcValorServicos(max)).toBe(2250);
  });

  it("nutrição não utilizada → R$ 0", () => {
    const naoUsada: ServicoUtilizado[] = [
      { tipo: "nutricao", utilizado: false },
    ];
    expect(calcValorServicos(naoUsada)).toBe(0);
  });
});

// ─── calcCreditosPorFrequencia ────────────────────────────────────────────────

describe("calcCreditosPorFrequencia", () => {
  describe("mensal", () => {
    it("1x/sem → 4 créditos", () => expect(calcCreditosPorFrequencia(1, "mensal")).toBe(4));
    it("2x/sem → 8 créditos", () => expect(calcCreditosPorFrequencia(2, "mensal")).toBe(8));
    it("3x/sem → 12 créditos", () => expect(calcCreditosPorFrequencia(3, "mensal")).toBe(12));
    it("Livre (5) → 20 créditos", () => expect(calcCreditosPorFrequencia(5, "mensal")).toBe(20));
  });

  describe("anual", () => {
    it("1x/sem → 52 créditos", () => expect(calcCreditosPorFrequencia(1, "anual")).toBe(52));
    it("2x/sem → 104 créditos", () => expect(calcCreditosPorFrequencia(2, "anual")).toBe(104));
    it("3x/sem → 156 créditos", () => expect(calcCreditosPorFrequencia(3, "anual")).toBe(156));
    it("Livre (5) → 260 créditos", () => expect(calcCreditosPorFrequencia(5, "anual")).toBe(260));
  });
});

// ─── calcRescisao — Start mensal ─────────────────────────────────────────────

describe("calcRescisao — Start mensal (sem multa)", () => {
  const startMensal: Contrato = {
    ...BASE_CONTRATO_RECORRENCIA,
    plano_tipo: "start",
    vigencia_tipo: "mensal",
    forma_pagamento: "cartao_recorrencia",
    parcelas: 1,
    valor_cobrado: 399,
  };

  it("tipo é start_sem_multa", () => {
    const r = calcRescisao(startMensal, SEM_SERVICOS);
    expect(r.tipo).toBe("start_sem_multa");
  });

  it("total_devido é zero", () => {
    const r = calcRescisao(startMensal, SEM_SERVICOS);
    expect(r.total_devido).toClipboard is not available. Use keyboard shortcuts instead.Clipboard is not available. Use keyboard shortcuts instead.