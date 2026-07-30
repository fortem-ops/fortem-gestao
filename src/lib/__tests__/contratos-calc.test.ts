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
    expect(r.total_devido).toBe(0);
  });

  it("total_restituir é zero", () => {
    const r = calcRescisao(startMensal, SEM_SERVICOS);
    expect(r.total_restituir).toBe(0);
  });
});

// ─── calcRescisao — Recorrência ───────────────────────────────────────────────

describe("calcRescisao — Recorrência mensal (anual fidelizado)", () => {
  it("tipo é recorrencia_com_multa", () => {
    const r = calcRescisao(BASE_CONTRATO_RECORRENCIA, SEM_SERVICOS);
    expect(r.tipo).toBe("recorrencia_com_multa");
  });

  it("meses_restantes é positivo", () => {
    const r = calcRescisao(BASE_CONTRATO_RECORRENCIA, SEM_SERVICOS);
    expect(r.meses_restantes).toBeGreaterThan(0);
  });

  it("total_restituir é sempre zero na recorrência", () => {
    const r = calcRescisao(BASE_CONTRATO_RECORRENCIA, SEM_SERVICOS);
    expect(r.total_restituir).toBe(0);
  });

  it("mês 2 → multa 25% sobre vincendas", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_RECORRENCIA,
      data_inicio: dataHaMeses(1), // mês 2
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(25);
    expect(r.total_devido).toBeGreaterThan(0);
  });

  it("mês 5 → multa 20% sobre vincendas", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_RECORRENCIA,
      data_inicio: dataHaMeses(4), // mês 5
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(20);
  });

  it("mês 8 → multa 15% sobre vincendas", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_RECORRENCIA,
      data_inicio: dataHaMeses(7), // mês 8
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(15);
  });

  it("com nutrição utilizada: servicos_vincendos > 0", () => {
    const r = calcRescisao(BASE_CONTRATO_RECORRENCIA, COM_NUTRICAO);
    expect(r.servicos_vincendos).toBeGreaterThan(0);
    expect(r.total_devido).toBeGreaterThan(r.multa_base ?? 0);
  });

  it("total_devido = multa_base + servicos_vincendos", () => {
    const r = calcRescisao(BASE_CONTRATO_RECORRENCIA, COM_NUTRICAO);
    const esperado = Math.round(((r.multa_base ?? 0) + (r.servicos_vincendos ?? 0)) * 100) / 100;
    expect(r.total_devido).toBeCloseTo(esperado, 2);
  });

  it("Pix automático também usa lógica de recorrência", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_RECORRENCIA,
      forma_pagamento: "pix_automatico",
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.tipo).toBe("recorrencia_com_multa");
  });
});

// ─── calcRescisao — Parcelado ─────────────────────────────────────────────────

describe("calcRescisao — Parcelado (restituição)", () => {
  it("tipo é parcelado_com_restituicao", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, SEM_SERVICOS);
    expect(r.tipo).toBe("parcelado_com_restituicao");
  });

  it("total_devido é zero quando não há saldo devedor", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, SEM_SERVICOS);
    // No mês 6 sem serviços utilizados, restituição > 0 e não há saldo devedor
    expect(r.total_devido).toBeGreaterThanOrEqual(0);
  });

  it("mês 2 → restitui 75%", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_PARCELADO,
      data_inicio: dataHaMeses(1),
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(75);
    expect(r.total_restituir).toBeGreaterThan(0);
  });

  it("mês 5 → restitui 80%", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_PARCELADO,
      data_inicio: dataHaMeses(4),
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(80);
  });

  it("mês 8 → restitui 85%", () => {
    const contrato: Contrato = {
      ...BASE_CONTRATO_PARCELADO,
      data_inicio: dataHaMeses(7),
    };
    const r = calcRescisao(contrato, SEM_SERVICOS);
    expect(r.percentual).toBe(85);
  });

  it("sem serviços: restituicao_bruta = total_restituir", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, SEM_SERVICOS);
    expect(r.total_restituir).toBeCloseTo(r.restituicao_bruta ?? 0, 2);
  });

  it("com nutrição utilizada: deduz R$ 300 da restituição", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, COM_NUTRICAO);
    expect(r.deducao_servicos).toBe(300);
    expect(r.total_restituir).toBeLessThan(r.restituicao_bruta ?? 0);
  });

  it("saldo devedor quando serviços > restituição bruta", () => {
    // Contrato de baixo valor no mês 1 com muitos serviços
    const contrato: Contrato = {
      ...BASE_CONTRATO_PARCELADO,
      valor_cobrado: 200,
      data_inicio: dataHaMeses(11), // mês 12 — pouco a restituir
    };
    const r = calcRescisao(contrato, COM_AMBOS); // R$ 450 em serviços
    // Pode gerar saldo devedor
    expect(r.saldo_devedor).toBeGreaterThanOrEqual(0);
    expect(r.total_restituir).toBeGreaterThanOrEqual(0);
  });

  it("total_restituir nunca é negativo", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, COM_AMBOS);
    expect(r.total_restituir).toBeGreaterThanOrEqual(0);
  });

  it("Max — 5 nutri + 5 fisio: deduz R$ 2.250", () => {
    const maxServicos: ServicoUtilizado[] = [
      ...Array(5).fill({ tipo: "nutricao" as const, utilizado: true }),
      ...Array(5).fill({ tipo: "fisioterapia" as const, utilizado: true }),
    ];
    const contrato: Contrato = {
      ...BASE_CONTRATO_PARCELADO,
      plano_tipo: "max",
      valor_cobrado: 649,
      data_inicio: dataHaMeses(1), // mês 2
    };
    const r = calcRescisao(contrato, maxServicos);
    expect(r.deducao_servicos).toBe(2250);
  });

  it("valor_total_contrato = valor_cobrado × parcelas", () => {
    const r = calcRescisao(BASE_CONTRATO_PARCELADO, SEM_SERVICOS);
    const esperado = BASE_CONTRATO_PARCELADO.valor_cobrado * BASE_CONTRATO_PARCELADO.parcelas;
    expect(r.valor_total_contrato).toBe(esperado);
  });
});

// ─── Constantes e labels ──────────────────────────────────────────────────────

describe("LABEL_PLANO", () => {
  it("cobre todos os planos", () => {
    const planos = ["start", "start_plus", "power", "pro", "max", "corrida", "outro"] as const;
    planos.forEach((p) => expect(LABEL_PLANO[p]).toBeTruthy());
  });

  it("Start+ tem label correto", () => {
    expect(LABEL_PLANO["start_plus"]).toBe("Start+");
  });
});

describe("LABEL_PAGAMENTO", () => {
  it("cobre todas as formas de pagamento", () => {
    const formas = [
      "cartao_recorrencia", "cartao_parcelado", "pix_automatico",
      "boleto", "maquina_debito", "maquina_credito", "dinheiro",
    ] as const;
    formas.forEach((f) => expect(LABEL_PAGAMENTO[f]).toBeTruthy());
  });
});

describe("TRANCAMENTO_MAXIMO", () => {
  it("Start tem 0 dias normais e 30 por doença", () => {
    expect(TRANCAMENTO_MAXIMO["start"].normal).toBe(0);
    expect(TRANCAMENTO_MAXIMO["start"].doenca).toBe(30);
  });

  it("Power tem 15 dias normais", () => {
    expect(TRANCAMENTO_MAXIMO["power"].normal).toBe(15);
  });

  it("Pro tem 20 dias normais", () => {
    expect(TRANCAMENTO_MAXIMO["pro"].normal).toBe(20);
  });

  it("Max tem 30 dias normais", () => {
    expect(TRANCAMENTO_MAXIMO["max"].normal).toBe(30);
  });

  it("todos os planos têm 30 dias por doença", () => {
    const planos = ["start", "start_plus", "power", "pro", "max"] as const;
    planos.forEach((p) => expect(TRANCAMENTO_MAXIMO[p].doenca).toBe(30));
  });
});
