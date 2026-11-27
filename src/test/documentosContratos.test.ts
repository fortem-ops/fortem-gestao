import { describe, expect, it } from "vitest";
import { separarDocumentosContratos } from "../lib/documentosContratos";

describe("documentos exibidos para aceite no portal", () => {
  it("mantém todos os contratos antigos e repetidos, inclusive sem tipo de plano", () => {
    const grupos = separarDocumentosContratos([
      { id: "antigo-1", contratos: { plano_tipo: "start" } },
      { id: "antigo-2", contratos: { plano_tipo: "start" } },
      { id: "sem-modelo", contratos: null },
      { id: "corrida", contratos: { plano_tipo: "corrida" } },
    ]);
    expect(grupos.funcionais.map((d) => d.id)).toEqual(["antigo-1", "antigo-2", "sem-modelo"]);
    expect(grupos.corrida.map((d) => d.id)).toEqual(["corrida"]);
  });
});
