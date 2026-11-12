import { describe, it, expect } from "vitest";
import { idsAbertos, alternarSelecao, loteValido } from "@/lib/auditoriaSelecao";

const itens = [
  { id: "a", status: "aberto" },
  { id: "b", status: "resolvido" },
  { id: "c", status: "aberto" },
  { id: "d", status: "ignorado" },
];

describe("seleção em massa da Auditoria", () => {
  it("selecionar todos pega só os abertos", () => {
    expect([...idsAbertos(itens)].sort()).toEqual(["a", "c"]);
  });
  it("não seleciona item já resolvido", () => {
    expect(alternarSelecao(new Set(), itens[1]).size).toBe(0);
    expect(alternarSelecao(new Set(), itens[0]).has("a")).toBe(true);
  });
  it("lote remove itens não abertos ou que sumiram da tela", () => {
    const lote = loteValido(new Set(["a", "b", "z"]), itens);
    expect(lote).toEqual(["a"]);
  });
});
