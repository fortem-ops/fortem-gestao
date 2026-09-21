import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FuncionalV2Viewer } from "@/components/student/assessment/funcionalV2/FuncionalV2Viewer";
import type { Tables } from "@/integrations/supabase/types";

vi.mock("@/components/student/assessment/funcionalV2/BodyMap", () => ({
  BodyMap: () => <div data-testid="body-map" />,
}));

const avaliacao = {
  id: "a1",
  tipo: "funcional_v2",
  data: "2026-01-10",
  observacoes: null,
  dados: {
    metricas: [
      { metric: "Mobilidade Ombro RI", left: 100, right: 80, leftClass: "Bom", rightClass: "Regular" },
    ],
  },
} as unknown as Tables<"avaliacoes">;

describe("FuncionalV2Viewer", () => {
  it("mostra a diferença entre os lados com o nível de assimetria, sem a classificação antiga", () => {
    render(<FuncionalV2Viewer avaliacao={avaliacao} />);

    // 100 vs 80 => 20% => nível moderada => "Atenção"
    expect(screen.getByText(/20\.0% · Atenção/)).toBeInTheDocument();
    expect(screen.getByText("Mobilidade Ombro - Rotação Interna")).toBeInTheDocument();
    expect(screen.queryByText("Bom")).toBeNull();
    expect(screen.queryByText("Regular")).toBeNull();
    expect(screen.queryByText("Class. E")).toBeNull();
    expect(screen.queryByText("Class. D")).toBeNull();
  });
});
