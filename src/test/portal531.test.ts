import { describe, it, expect } from "vitest";
import { treinoDoDia531, variacao531 } from "@/pages/portal/PortalWorkouts";

describe("treino do dia 5-3-1", () => {
  it("sem registro abre o Treino 1", () => {
    expect(treinoDoDia531([1, 2, 3], 1, [])).toBe(1);
  });
  it("abre o primeiro treino não concluído da semana escolhida", () => {
    const s = [{ variacao: variacao531(2, 1), concluido_em: "x" }];
    expect(treinoDoDia531([1, 2, 3], 2, s)).toBe(2);
    expect(treinoDoDia531([1, 2, 3], 1, s)).toBe(1);
  });
});
