import { describe, expect, it } from "vitest";
import {
  calcularAssimetriaPct,
  faixaAssimetria,
  gerarSugestoesAquecimento,
  type ExercicioVinculado,
} from "@/components/avaliacoes-premium/aquecimentoSugestoes";

const ex = (id: string, nome: string, articulacoes: string[]): ExercicioVinculado => ({
  id, nome, articulacoes, video_url: null, categoria: "Mobilidade Articular",
});

const metric = (metric: string, left: number, right: number) => ({
  metric, left, right, leftClass: null, rightClass: null,
});

describe("aquecimentoSugestoes", () => {
  it("calcula assimetria e faixas", () => {
    expect(calcularAssimetriaPct(80, 100)).toBeCloseTo(20);
    expect(calcularAssimetriaPct(null, 100)).toBeNull();
    expect(faixaAssimetria(5)).toBeNull();
    expect(faixaAssimetria(10)).toBe("amarela");
    expect(faixaAssimetria(20)).toBe("amarela");
    expect(faixaAssimetria(20.1)).toBe("vermelha");
  });

  it("sugere só para faixa amarela/vermelha, no lado deficitário, sem repetir", () => {
    const vinculados = [
      ex("a", "Rotação ombro", ["ombro-ri-esquerdo", "ombro-ri-direito"]),
      ex("b", "Mob ombro E", ["ombro-ri-esquerdo"]),
      ex("c", "Tornozelo", ["tornozelo-direito"]),
    ];
    const out = gerarSugestoesAquecimento(
      [metric("Mobilidade Ombro RI", 60, 100), metric("Mobilidade Tornozelo", 40, 38)],
      vinculados,
    );
    expect(out).toHaveLength(1);
    expect(out[0].faixa).toBe("vermelha");
    expect(out[0].ladoDeficitario).toBe("esquerdo");
    expect(out[0].chaveDeficitaria).toBe("ombro-ri-esquerdo");
    expect(out[0].exercicios.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("trata flexibilidade e Psoas invertido (maior = pior)", () => {
    const out = gerarSugestoesAquecimento(
      [metric("Flexibilidade Psoas", 10, 14), metric("Flexibilidade Quadríceps", 100, 85)],
      [ex("p", "Psoas", ["psoas-direito"])],
    );
    const psoas = out.find((s) => s.metric === "Flexibilidade Psoas")!;
    expect(psoas.ladoDeficitario).toBe("direito");
    expect(psoas.area).toBe("flexibilidade");
    expect(psoas.exercicios).toHaveLength(1);
    const quad = out.find((s) => s.metric === "Flexibilidade Quadríceps")!;
    expect(quad.ladoDeficitario).toBe("direito");
    expect(quad.exercicios).toHaveLength(0);
  });
});
