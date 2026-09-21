import { describe, it, expect } from "vitest";
import {
  quadricepsEntradaParaValor,
  quadricepsValorParaEntrada,
  QUADRICEPS_OFFSET_GRAUS,
  METRICA_QUADRICEPS,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { classifyAngle } from "@/lib/mock-data";

describe("Flexibilidade Quadríceps — offset de 90° no lançamento", () => {
  it("soma 90° à leitura do goniômetro", () => {
    expect(QUADRICEPS_OFFSET_GRAUS).toBe(90);
    expect(quadricepsEntradaParaValor(45)).toBe(135);
    expect(quadricepsEntradaParaValor(0)).toBe(90);
    expect(quadricepsEntradaParaValor(60)).toBe(150);
  });

  it("converte o valor salvo de volta para a leitura na edição", () => {
    expect(quadricepsValorParaEntrada(135)).toBe(45);
    expect(quadricepsValorParaEntrada(90)).toBe(0);
  });

  it("ida e volta são simétricas", () => {
    for (const leitura of [0, 12, 30, 45, 55, 70]) {
      expect(quadricepsValorParaEntrada(quadricepsEntradaParaValor(leitura))).toBe(leitura);
    }
  });

  it("classificação usa o valor absoluto (após o +90°)", () => {
    // Faixas: Fraco ≤120 · Regular 121–130 · Médio 131–140 · Bom 141–149 · Excelente ≥150
    expect(classifyAngle(METRICA_QUADRICEPS, quadricepsEntradaParaValor(45))).toBe("Médio"); // 135
    expect(classifyAngle(METRICA_QUADRICEPS, quadricepsEntradaParaValor(60))).toBe("Excelente"); // 150
    expect(classifyAngle(METRICA_QUADRICEPS, quadricepsEntradaParaValor(30))).toBe("Fraco"); // 120
    expect(classifyAngle(METRICA_QUADRICEPS, quadricepsEntradaParaValor(35))).toBe("Regular"); // 125
    expect(classifyAngle(METRICA_QUADRICEPS, quadricepsEntradaParaValor(55))).toBe("Bom"); // 145
  });

  it("demais métricas não sofrem conversão", () => {
    expect(classifyAngle("Mobilidade Torácica", 50)).toBe("Bom");
    expect(classifyAngle("Flexibilidade Posterior MMII", 85)).toBe("Excelente");
    expect(classifyAngle("Flexibilidade Psoas", 0)).toBe("Excelente");
  });
});
