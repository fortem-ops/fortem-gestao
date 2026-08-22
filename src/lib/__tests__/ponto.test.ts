import { describe, it, expect } from "vitest";
import {
  calculateTolerance,
  calculateDailyDeviation,
  validateLegalTolerance,
  calculateBankHours,
  divergenciaTone,
  formatDivergencia,
  DEFAULT_TOLERANCIA,
  type JornadaTolerancia,
} from "@/lib/pontoTolerancia";
import { formatMinutes, haversineDistM, localMaisProximo, FORTEM_LOCAIS } from "@/lib/ponto";

const j = (over: Partial<JornadaTolerancia> = {}): JornadaTolerancia => ({ ...over });

describe("calculateTolerance — limiar de 5 min por marcação", () => {
  it("ignora até 5 min (inclusive) em ambos os sentidos", () => {
    [0, 1, 5, -5, -1].forEach((d) => expect(calculateTolerance(d)).toBe("ignorada"));
  });
  it("considera acima de 5 min em ambos os sentidos", () => {
    [6, -6, 30, -120].forEach((d) => expect(calculateTolerance(d)).toBe("considerada"));
  });
  it("respeita configuração customizada", () => {
    expect(calculateTolerance(8, { tolerancia_marcacao_min: 10, tolerancia_diaria_min: 20 })).toBe("ignorada");
    expect(calculateTolerance(11, { tolerancia_marcacao_min: 10, tolerancia_diaria_min: 20 })).toBe("considerada");
  });
  it("usa 5/10 como padrão", () => {
    expect(DEFAULT_TOLERANCIA).toEqual({ tolerancia_marcacao_min: 5, tolerancia_diaria_min: 10 });
  });
});

describe("calculateDailyDeviation", () => {
  it("soma valores absolutos das três marcações", () => {
    expect(
      calculateDailyDeviation(j({ divergencia_entrada_min: 3, divergencia_saida_min: -4, divergencia_intervalo_min: 2 })),
    ).toBe(9);
  });
  it("trata nulos e ausentes como zero", () => {
    expect(calculateDailyDeviation(j())).toBe(0);
    expect(calculateDailyDeviation(j({ divergencia_entrada_min: null, divergencia_saida_min: 7 }))).toBe(7);
  });
});

describe("validateLegalTolerance — regra CLT 5 min / 10 min diários", () => {
  it("dentro da tolerância: cada marcação ≤5 e soma ≤10", () => {
    expect(
      validateLegalTolerance(j({ divergencia_entrada_min: 5, divergencia_saida_min: -5, divergencia_intervalo_min: 0 })),
    ).toBe(false);
  });
  it("excede quando uma marcação passa de 5 min", () => {
    expect(validateLegalTolerance(j({ divergencia_entrada_min: 6 }))).toBe(true);
    expect(validateLegalTolerance(j({ divergencia_saida_min: -6 }))).toBe(true);
  });
  it("excede quando a soma diária passa de 10 min mesmo com marcações pequenas", () => {
    expect(
      validateLegalTolerance(j({ divergencia_entrada_min: 4, divergencia_saida_min: 4, divergencia_intervalo_min: 4 })),
    ).toBe(true);
  });
  it("soma exatamente 10 min ainda está dentro", () => {
    expect(
      validateLegalTolerance(j({ divergencia_entrada_min: 5, divergencia_saida_min: 5, divergencia_intervalo_min: 0 })),
    ).toBe(false);
  });
  it("dia sem divergência não excede", () => {
    expect(validateLegalTolerance(j())).toBe(false);
  });
  it("respeita configuração customizada", () => {
    const cfg = { tolerancia_marcacao_min: 10, tolerancia_diaria_min: 30 };
    expect(validateLegalTolerance(j({ divergencia_entrada_min: 8, divergencia_saida_min: 8 }), cfg)).toBe(false);
    expect(validateLegalTolerance(j({ divergencia_entrada_min: 20 }), cfg)).toBe(true);
  });
});

describe("calculateBankHours", () => {
  it("saldo positivo quando extras superam descontos", () => {
    expect(calculateBankHours(j({ minutos_extras_validos: 45, minutos_descontaveis: 15 }))).toBe(30);
  });
  it("saldo negativo quando há mais descontos", () => {
    expect(calculateBankHours(j({ minutos_extras_validos: 0, minutos_descontaveis: 25 }))).toBe(-25);
  });
  it("saldo zero em dia neutro ou vazio", () => {
    expect(calculateBankHours(j())).toBe(0);
    expect(calculateBankHours(j({ minutos_extras_validos: 20, minutos_descontaveis: 20 }))).toBe(0);
  });
});

describe("divergenciaTone", () => {
  it("neutro para zero, null ou undefined", () => {
    expect(divergenciaTone(0, true)).toBe("neutral");
    expect(divergenciaTone(null, true)).toBe("neutral");
    expect(divergenciaTone(undefined, false)).toBe("neutral");
  });
  it("tolerada quando a tolerância não foi excedida", () => {
    expect(divergenciaTone(4, false)).toBe("tolerada");
    expect(divergenciaTone(-3, null)).toBe("tolerada");
  });
  it("desconto para divergência positiva excedida e extra para negativa", () => {
    expect(divergenciaTone(12, true)).toBe("desconto");
    expect(divergenciaTone(-12, true)).toBe("extra");
  });
});

describe("formatDivergencia", () => {
  it("formata zero e nulos", () => {
    expect(formatDivergencia(0)).toBe("0 min");
    expect(formatDivergencia(null)).toBe("0 min");
    expect(formatDivergencia(undefined)).toBe("0 min");
  });
  it("usa + para atraso e sinal menos tipográfico para adiantamento", () => {
    expect(formatDivergencia(7)).toBe("+7 min");
    expect(formatDivergencia(-7)).toBe("−7 min");
  });
});

describe("formatMinutes", () => {
  it("formata horas e minutos com padding", () => {
    expect(formatMinutes(192)).toBe("3h 12m");
    expect(formatMinutes(65)).toBe("1h 05m");
    expect(formatMinutes(120)).toBe("2h 00m");
  });
  it("abaixo de uma hora mostra só minutos", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(59)).toBe("59m");
  });
  it("retorna travessão para nulo ou NaN", () => {
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(undefined)).toBe("—");
    expect(formatMinutes(NaN)).toBe("—");
  });
});

describe("haversineDistM", () => {
  it("distância zero para o mesmo ponto", () => {
    expect(haversineDistM(-30.029346, -51.21784, -30.029346, -51.21784)).toBe(0);
  });
  it("é simétrica", () => {
    const a = haversineDistM(-30.029346, -51.21784, -30.044967, -51.232644);
    const b = haversineDistM(-30.044967, -51.232644, -30.029346, -51.21784);
    expect(a).toBeCloseTo(b, 6);
  });
  it("aproxima 111 km por grau de latitude", () => {
    expect(haversineDistM(0, 0, 1, 0)).toBeGreaterThan(110000);
    expect(haversineDistM(0, 0, 1, 0)).toBeLessThan(112000);
  });
  it("distância entre Matriz e Orla é de poucos km", () => {
    const d = haversineDistM(-30.029346, -51.21784, -30.044967, -51.232644);
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(3000);
  });
});

describe("localMaisProximo — 3 locais oficiais Fortem", () => {
  it("mantém os três locais cadastrados com as coordenadas oficiais", () => {
    expect(FORTEM_LOCAIS).toHaveLength(3);
    expect(FORTEM_LOCAIS.map((l) => l.nome)).toEqual(["Fortem Matriz", "Orla", "Pista Ramiro Souto"]);
    expect(FORTEM_LOCAIS[0]).toMatchObject({ lat: -30.029346, lng: -51.21784 });
    expect(FORTEM_LOCAIS[1]).toMatchObject({ lat: -30.044967, lng: -51.232644 });
    expect(FORTEM_LOCAIS[2]).toMatchObject({ lat: -30.035945, lng: -51.213151 });
  });

  it.each(FORTEM_LOCAIS.map((l) => [l.nome, l.lat, l.lng] as const))(
    "reconhece %s exatamente sobre o ponto",
    (nome, lat, lng) => {
      const r = localMaisProximo(lat, lng);
      expect(r.nome).toBe(nome);
      expect(r.distM).toBe(0);
    },
  );

  it("ponto a poucos metros da Matriz fica dentro do raio de 300m", () => {
    const r = localMaisProximo(-30.0295, -51.2179);
    expect(r.nome).toBe("Fortem Matriz");
    expect(r.distM).toBeLessThan(300);
  });

  it("ponto entre Orla e Ramiro Souto escolhe o mais próximo", () => {
    const r = localMaisProximo(-30.0445, -51.2325);
    expect(r.nome).toBe("Orla");
  });

  it("ponto distante fica fora do raio de 300m de todos os locais", () => {
    const r = localMaisProximo(-23.55052, -46.633308); // São Paulo
    expect(r.distM).toBeGreaterThan(300);
    expect(r.distM).toBeGreaterThan(500000);
  });

  it("sempre retorna um dos locais oficiais", () => {
    const r = localMaisProximo(0, 0);
    expect(FORTEM_LOCAIS.map((l) => l.nome)).toContain(r.nome);
    expect(Number.isFinite(r.distM)).toBe(true);
  });
});
