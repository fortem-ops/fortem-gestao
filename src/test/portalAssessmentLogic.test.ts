import { describe, expect, it } from "vitest";
import type { FuncionalSnapshot } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import {
  deduplicarCadeias,
  filtrarComparativoMudou,
  montarAneisPortal,
  montarMedidasPortal,
  montarResumoPortal,
} from "@/components/portal/portalAssessmentLogic";

const snapshot = (ombroE: number, ombroD: number, psoasE = 2, psoasD = 3): FuncionalSnapshot => ({
  data: "2026-09-21",
  metricas: [
    { metric: "Mobilidade Ombro RI", left: ombroE, right: ombroD, leftClass: null, rightClass: null },
    { metric: "Flexibilidade Psoas", left: psoasE, right: psoasD, leftClass: null, rightClass: null },
  ],
  forca: [],
});

describe("Resumo do portal de avaliações", () => {
  it("monta a frase com pontos e maior diferença", () => {
    const resumo = montarResumoPortal(montarMedidasPortal(snapshot(60, 90)));
    expect(resumo.titulo).toBe("1 ponto para acompanhar");
    expect(resumo.frase).toContain("Ombro · Rotação Interna");
    expect(resumo.frase).toContain("A outra medida está equilibrada.");
  });

  it("monta a frase de tudo equilibrado", () => {
    expect(montarResumoPortal(montarMedidasPortal(snapshot(90, 92)))).toEqual({
      titulo: "Tudo equilibrado",
      frase: "Nenhuma medida mostrou diferença importante entre os lados.",
      pontos: 0,
      equilibradas: 2,
    });
  });

  it("conta os anéis por camada e mantém força sem dado", () => {
    expect(montarAneisPortal(montarMedidasPortal(snapshot(60, 90)))).toEqual([
      { camada: "mobilidade", label: "Mobilidade", pontos: 1, total: 1, piorNivel: "prioridade" },
      { camada: "flexibilidade", label: "Flexibilidade", pontos: 0, total: 1, piorNivel: "equilibrado" },
      { camada: "forca", label: "Força", pontos: 0, total: 0, piorNivel: null },
    ]);
  });

  it("remove cadeias repetidas pelo texto", () => {
    const chains = deduplicarCadeias([
      { from: "thoracic", to: "shoulder-l", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." },
      { from: "thoracic", to: "shoulder-r", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." },
    ]);
    expect(chains).toHaveLength(1);
  });

  it("comparativo mantém somente medidas que mudaram", () => {
    const anterior = snapshot(60, 80, 2, 3);
    const atual = snapshot(65, 80, 2, 3);
    const comparativo = filtrarComparativoMudou(anterior, atual);
    expect(comparativo.mobilidade.map((row) => row.metric)).toEqual(["Mobilidade Ombro RI"]);
    expect(comparativo.mobilidadeSemMudanca).toBe(1);
    expect(comparativo.forca).toEqual([]);
  });
});