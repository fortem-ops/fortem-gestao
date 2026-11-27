import { describe, expect, it } from "vitest";
import { destinoLembrete } from "@/components/dashboard/LembreteAvaliacoesPendentesBanner";

describe("destinoLembrete", () => {
  it("direciona treino experimental para novo relatório experimental do prospect", () => {
    expect(destinoLembrete({ alunoId: "aluno-123", atividade: "Treino Experimental" })).toBe(
      "/avaliacoes?aluno=aluno-123&new=1&tipo=experimental",
    );
  });

  it("mantém avaliação funcional direcionada para a tela de avaliações", () => {
    expect(destinoLembrete({ alunoId: "aluno-456", atividade: "Avaliação Funcional" })).toBe(
      "/avaliacoes-premium/aluno-456",
    );
  });
});