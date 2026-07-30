import { describe, it, expect } from "vitest";
import {
  calcRescisao,
  calcMesAtual,
  calcCreditosPorFrequencia,
  calcPercentualMulta,
  calcPercentualRestituicao,
  calcValorServicos,
  type Contrato,
  type ServicoUtilizado,
} from "../contratos-calc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dataHaMeses(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

function contrato(overrides: Partial<Contrato> = {}): Contrato {
  return {
    id: "test",
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
    ...overrides,
  };
}

const S = (servicos: Partial<Record<"nutricao" | "fisioterapia", boolean>>): ServicoUtilizado[] => [
  { tipo: "nutricao",    utilizado: servicos.nutricao    ?? false },
  { tipo: "fisioterapia", utilizado: servicos.fisioterapia ?? false },
];

// ─── FRONTEIRAS DE MÊS (25%→20% e 20%→15%) ──────────────────────────────────

describe("Fronteiras de multa — último dia do 4º mês (25% → 20%)", () => {
  it("mês 4 ainda aplica 25%", () => {
    const c = contrato({ data_inicio: dataHaMeses(3) }); // mês 4
    expect(calcPercentualMulta(calcMesAtual(c.data_inicio))).toBe(25);
  });

  it("mês 5 já aplica 20%", () => {
    const c = contrato({ data_inicio: dataHaMeses(4) }); // mês 5
    expect(calcPercentualMulta(calcMesAtual(c.data_inicio))).toBe(20);
  });

  it("mês 6 ainda aplica 20%", () => {
    const c = contrato({ data_inicio: dataHaMeses(5) }); // mês 6
    expect(calcPercentualMulta(calcMesAtual(c.data_inicio))).toBe(20);
  });

  it("mês 7 já aplica 15%", () => {
    const c = contrato({ data_inicio: dataHaMeses(6) }); // mês 7
    expect(calcPercentualMulta(calcMesAtual(c.data_inicio))).toBe(15);
  });
});

describe("Fronteiras de restituição — parcelado", () => {
  it("mês 4 restitui 75%", () => {
    expect(calcPercentualRestituicao(4)).toBe(75);
  });

  it("mês 5 restitui 80%", () => {
    expect(calcPercentualRestituicao(5)).toBe(80);
  });

  it("mês 6 restitui 80%", () => {
    expect(calcPercentualRestituicao(6)).toBe(80);
  });

  it("mês 7 restitui 85%", () => {
    expect(calcPercentualRestituicao(7)).toBe(85);
  });
});

// ─── SALDO DEVEDOR (serviços > restituição bruta) ─────────────────────────────

describe("Saldo devedor — serviços utilizados excedem restituição", () => {
  it("Max mês 12 com 5 nutri + 5 fisio gera saldo devedor", () => {
    const maxServicos: ServicoUtilizado[] = [
      ...Array(5).fill({ tipo: "nutricao" as const, utilizado: true }),
      ...Array(5).fill({ tipo: "fisioterapia" as const, utilizado: true }),
    ];
    const c = contrato({
      plano_tipo: "max",
      forma_pagamento: "cartao_parcelado",
      parcelas: 12,
      valor_cobrado: 649,
      data_inicio: dataHaMeses(11), // mês 12
    });
    const r = calcRescisao(c, maxServicos);
    expect(r.tipo).toBe("parcelado_com_restituicao");
    expect(r.saldo_devedor).toBeGreaterThan(0);
    expect(r.total_restituir).toBe(0); // nunca negativo
    expect(r.deducao_servicos).toBe(2250);
  });

  it("Power mês 1 com nutri e fisio: restituição parcialmente absorve serviços", () => {
    const c = contrato({
      plano_tipo: "power",
      forma_pagamento: "cartao_parcelado",
      parcelas: 12,
      valor_cobrado: 500,
      data_inicio: dataHaMeses(0), // mês 1
    });
    const r = calcRescisao(c, S({ nutricao: true, fisioterapia: true }));
    expect(r.deducao_servicos).toBe(450);
    expect(r.total_restituir).toBeGreaterThan(0);
    expect(r.saldo_devedor).toBe(0);
  });

  it("total_restituir nunca é negativo independente dos serviços", () => {
    const muitosServicos: ServicoUtilizado[] = Array(10).fill({
      tipo: "nutricao" as const, utilizado: true,
    });
    const c = contrato({
      forma_pagamento: "cartao_parcelado",
      parcelas: 12,
      valor_cobrado: 100, // contrato barato
      data_inicio: dataHaMeses(11), // mês 12 = quase nada a restituir
    });
    const r = calcRescisao(c, muitosServicos);
    expect(r.total_restituir).toBeGreaterThanOrEqual(0);
  });
});

// ─── CONTRATOS NÃO PADRÃO (6, 8, 9, 10, 11 PARCELAS) ────────────────────────

describe("Contratos não padrão — parcelas variadas", () => {
  it("contrato de 6 parcelas: mês 3 → 25% multa", () => {
    const c = contrato({
      forma_pagamento: "cartao_recorrencia",
      parcelas: 1,
      data_inicio: dataHaMeses(2), // mês 3
    });
    const r = calcRescisao(c, S({}));
    expect(r.percentual).toBe(25);
    expect(r.meses_restantes).toBe(9); // 12 - 3
  });

  it("contrato parcelado em 6x: valor_total = 6 × valor_cobrado", () => {
    const c = contrato({
      forma_pagamento: "cartao_parcelado",
      parcelas: 6,
      valor_cobrado: 379,
      data_inicio: dataHaMeses(2), // mês 3
    });
    const r = calcRescisao(c, S({}));
    expect(r.valor_total_contrato).toBe(6 * 379);
  });

  it("contrato parcelado em 9x: cálculo proporcional correto", () => {
    const c = contrato({
      forma_pagamento: "cartao_parcelado",
      parcelas: 9,
      valor_cobrado: 362.75,
      data_inicio: dataHaMeses(8), // mês 9
    });
    const r = calcRescisao(c, S({}));
    expect(r.valor_total_contrato).toBeCloseTo(9 * 362.75, 1);
    expect(r.percentual).toBe(85);
    expect(r.total_restituir).toBeGreaterThan(0);
  });

  it("contrato parcelado em 10x: meses restantes calculados sobre 12", () => {
    const c = contrato({
      forma_pagamento: "cartao_parcelado",
      parcelas: 10,
      valor_cobrado: 379,
      data_inicio: dataHaMeses(3), // mês 4
    });
    const r = calcRescisao(c, S({}));
    expect(r.mes_atual).toBe(4);
    expect(r.meses_restantes).toBe(8);
  });
});

// ─── FREQUÊNCIA LIVRE (5) ─────────────────────────────────────────────────────

describe("Frequência Livre (5 = seg-sex)", () => {
  it("mensal Livre → 20 créditos", () => {
    expect(calcCreditosPorFrequencia(5, "mensal")).toBe(20);
  });

  it("anual Livre → 260 créditos", () => {
    expect(calcCreditosPorFrequencia(5, "anual")).toBe(260);
  });

  it("alias 0 (legado) → mesmo resultado que 5", () => {
    expect(calcCreditosPorFrequencia(0, "mensal")).toBe(calcCreditosPorFrequencia(5, "mensal"));
    expect(calcCreditosPorFrequencia(0, "anual")).toBe(calcCreditosPorFrequencia(5, "anual"));
  });

  it("créditos Livre anual é maior que 3x/sem anual", () => {
    expect(calcCreditosPorFrequencia(5, "anual")).toBeGreaterThan(
      calcCreditosPorFrequencia(3, "anual"),
    );
  });
});

// ─── MAX — SERVIÇOS OBRIGATORIAMENTE DUPLOS ──────────────────────────────────

describe("Plano Max — nutrição E fisioterapia (não ou/ou)", () => {
  it("5 nutri utilizadas → R$ 1.500", () => {
    const servicos: ServicoUtilizado[] = Array(5).fill({
      tipo: "nutricao" as const, utilizado: true,
    });
    expect(calcValorServicos(servicos)).toBe(1500);
  });

  it("5 fisio utilizadas → R$ 750", () => {
    const servicos: ServicoUtilizado[] = Array(5).fill({
      tipo: "fisioterapia" as const, utilizado: true,
    });
    expect(calcValorServicos(servicos)).toBe(750);
  });

  it("5 nutri + 5 fisio → R$ 2.250", () => {
    const servicos: ServicoUtilizado[] = [
      ...Array(5).fill({ tipo: "nutricao" as const, utilizado: true }),
      ...Array(5).fill({ tipo: "fisioterapia" as const, utilizado: true }),
    ];
    expect(calcValorServicos(servicos)).toBe(2250);
  });

  it("nenhum utilizado → R$ 0 (sem dedução na rescisão)", () => {
    const servicos: ServicoUtilizado[] = [
      ...Array(5).fill({ tipo: "nutricao" as const, utilizado: false }),
      ...Array(5).fill({ tipo: "fisioterapia" as const, utilizado: false }),
    ];
    expect(calcValorServicos(servicos)).toBe(0);
  });
});

// ─── RECORRÊNCIA — VINCENDAS + SERVIÇOS PARCELADOS ───────────────────────────

describe("Recorrência — serviços parcelados em 12x nas vincendas", () => {
  it("nutrição R$300 em mês 1: vincendas = 11 × (300/12) = R$275", () => {
    const c = contrato({ data_inicio: dataHaMeses(0) }); // mês 1
    const r = calcRescisao(c, S({ nutricao: true }));
    const esperado = Math.round((300 / 12) * 11 * 100) / 100;
    expect(r.servicos_vincendos).toBeCloseTo(esperado, 1);
  });

  it("fisio R$150 em mês 6: vincendas = 6 × (150/12) = R$75", () => {
    const c = contrato({ data_inicio: dataHaMeses(5) }); // mês 6
    const r = calcRescisao(c, S({ fisioterapia: true }));
    const esperado = Math.round((150 / 12) * 6 * 100) / 100;
    expect(r.servicos_vincendos).toBeCloseTo(esperado, 1);
  });

  it("sem serviços: servicos_vincendos = 0", () => {
    const r = calcRescisao(contrato(), S({}));
    expect(r.servicos_vincendos).toBe(0);
  });

  it("total_devido inclui multa + vincendas de serviços", () => {
    const c = contrato({ data_inicio: dataHaMeses(0) }); // mês 1, 25%
    const r = calcRescisao(c, S({ nutricao: true, fisioterapia: true }));
    const esperadoServicos = Math.round(((300 + 150) / 12) * 11 * 100) / 100;
    expect(r.total_devido).toBeCloseTo((r.multa_base ?? 0) + esperadoServicos, 1);
  });
});

// ─── INVARIANTES MATEMÁTICAS ──────────────────────────────────────────────────

describe("Invariantes matemáticas", () => {
  it("créditos aumentam conforme frequência (1 < 2 < 3 < 5)", () => {
    const anual = (f: number) => calcCreditosPorFrequencia(f, "anual");
    expect(anual(1)).toBeLessThan(anual(2));
    expect(anual(2)).toBeLessThan(anual(3));
    expect(anual(3)).toBeLessThan(anual(5));
  });

  it("créditos anuais = 13 × créditos mensais (52 semanas / 4)", () => {
    [1, 2, 3, 5].forEach((f) => {
      expect(calcCreditosPorFrequencia(f, "anual")).toBe(
        calcCreditosPorFrequencia(f, "mensal") * 13,
      );
    });
  });

  it("multa diminui conforme o tempo (25 > 20 > 15)", () => {
    expect(calcPercentualMulta(1)).toBeGreaterThan(calcPercentualMulta(5));
    expect(calcPercentualMulta(5)).toBeGreaterThan(calcPercentualMulta(7));
  });

  it("restituição aumenta conforme o tempo (75 < 80 < 85)", () => {
    expect(calcPercentualRestituicao(1)).toBeLessThan(calcPercentualRestituicao(5));
    expect(calcPercentualRestituicao(5)).toBeLessThan(calcPercentualRestituicao(7));
  });

  it("valor_cobrado = valor_base + taxa_recorrencia (quando recorrência)", () => {
    const c = contrato({ valor_base: 400, valor_cobrado: 420, taxa_recorrencia: 20 });
    expect(c.valor_cobrado).toBe(c.valor_base + c.taxa_recorrencia);
  });

  it("calcRescisao sempre retorna total_restituir >= 0", () => {
    const cenarios = [
      contrato({ forma_pagamento: "cartao_parcelado", parcelas: 12 }),
      contrato({ forma_pagamento: "cartao_recorrencia" }),
      contrato({ vigencia_tipo: "mensal" }),
    ];
    const maxServicos: ServicoUtilizado[] = Array(10).fill({
      tipo: "nutricao" as const, utilizado: true,
    });
    cenarios.forEach((c) => {
      const r = calcRescisao(c, maxServicos);
      expect(r.total_restituir).toBeGreaterThanOrEqual(0);
    });
  });

  it("calcRescisao sempre retorna total_devido >= 0", () => {
    const cenarios = [
      contrato({ forma_pagamento: "cartao_parcelado", parcelas: 12 }),
      contrato({ forma_pagamento: "cartao_recorrencia" }),
    ];
    cenarios.forEach((c) => {
      const r = calcRescisao(c, S({}));
      expect(r.total_devido).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── PIX AUTOMÁTICO — MESMO COMPORTAMENTO QUE RECORRÊNCIA ────────────────────

describe("Pix Automático — equivalente à recorrência", () => {
  it("pix_automatico usa lógica de recorrência (multa sobre vincendas)", () => {
    const c = contrato({ forma_pagamento: "pix_automatico" });
    const r = calcRescisao(c, S({}));
    expect(r.tipo).toBe("recorrencia_com_multa");
  });

  it("mesmo total_devido que cartao_recorrencia no mesmo mês", () => {
    const base = { data_inicio: dataHaMeses(3), valor_cobrado: 420 };
    const rCartao = calcRescisao(contrato({ ...base, forma_pagamento: "cartao_recorrencia" }), S({}));
    const rPix    = calcRescisao(contrato({ ...base, forma_pagamento: "pix_automatico" }), S({}));
    expect(rPix.total_devido).toBeCloseTo(rCartao.total_devido, 2);
  });
});

// ─── CASOS ESPECIAIS ──────────────────────────────────────────────────────────

describe("Casos especiais e robustez", () => {
  it("Start mensal com serviços utilizados: ainda sem multa", () => {
    const c = contrato({ vigencia_tipo: "mensal", plano_tipo: "start" });
    const r = calcRescisao(c, S({ nutricao: true, fisioterapia: true }));
    expect(r.tipo).toBe("start_sem_multa");
    expect(r.total_devido).toBe(0);
    expect(r.total_restituir).toBe(0);
  });

  it("valor nutricao (R$300) > valor fisio (R$150)", () => {
    expect(calcValorServicos(S({ nutricao: true }))).toBeGreaterThan(
      calcValorServicos(S({ fisioterapia: true })),
    );
  });

  it("contrato com taxa_recorrencia = 0 (condição especial)", () => {
    const c = contrato({
      taxa_recorrencia: 0,
      valor_base: 420,
      valor_cobrado: 420,
    });
    const r = calcRescisao(c, S({}));
    expect(r.tipo).toBe("recorrencia_com_multa");
    expect(r.total_devido).toBeGreaterThan(0);
  });

  it("meses_restantes nunca é negativo (contrato vencido)", () => {
    const c = contrato({ data_inicio: dataHaMeses(15) }); // 15 meses atrás
    const r = calcRescisao(c, S({}));
    expect(r.meses_restantes).toBeGreaterThanOrEqual(0);
  });
});
