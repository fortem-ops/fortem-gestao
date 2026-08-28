import { describe, it, expect } from "vitest";
import { resolverAlvo, itemCasaAlvo, type TaxonomiaGrupo } from "@/lib/exerciseMapping";

const tree: TaxonomiaGrupo[] = [
  {
    nome: "Preparação movimento",
    categorias: [
      { nome: "Liberação miofascial", subcategorias: ["Quadril", "Lombar"] },
      { nome: "Mobilidade Articular", subcategorias: ["Quadril", "Glenoumeral"] },
      { nome: "Ativação Muscular", subcategorias: ["Quadril", "Perna"] },
      { nome: "Preventivo", subcategorias: ["Ombro"] },
    ],
  },
  {
    nome: "Força",
    categorias: [
      { nome: "Força", subcategorias: ["Dominante de Quadril", "Auxiliares"] },
    ],
  },
];

describe("resolverAlvo", () => {
  it("resolve bloco de aquecimento como categoria dentro do grupo", () => {
    expect(resolverAlvo("MOB", tree)).toEqual({
      grupo: "Preparação movimento",
      categoria: "Mobilidade Articular",
      label: "Mobilidade Articular",
    });
  });

  it("resolve código de força em grupo + subcategoria", () => {
    const a = resolverAlvo("DQ", tree);
    expect(a.grupo).toBe("Força");
    expect(a.subcategoria).toBe("Dominante de Quadril");
    expect(a.categoria).toBe("Força");
  });

  it("resolve nome de categoria mesmo quando não é mais um grupo", () => {
    expect(resolverAlvo("Liberação miofascial", tree)).toEqual({
      grupo: "Preparação movimento",
      categoria: "Liberação miofascial",
      label: "Liberação miofascial",
    });
  });

  it("resolve nome de subcategoria duplicada usando a primeira ocorrência", () => {
    const a = resolverAlvo("Quadril", tree);
    expect(a.subcategoria).toBe("Quadril");
    expect(a.categoria).toBe("Liberação miofascial");
  });

  it("faz fallback literal para nomes desconhecidos", () => {
    expect(resolverAlvo("Inexistente", tree)).toEqual({ grupo: "Inexistente", label: "Inexistente" });
  });
});

describe("itemCasaAlvo", () => {
  const alvo = resolverAlvo("MOB", tree);

  it("casa item com categoria correta", () => {
    expect(
      itemCasaAlvo(
        { grupo: "Preparação movimento", categoria: "Mobilidade Articular", subcategoria: "Quadril" },
        alvo,
      ),
    ).toBe(true);
  });

  it("não casa item de outra categoria com mesma subcategoria", () => {
    expect(
      itemCasaAlvo(
        { grupo: "Preparação movimento", categoria: "Liberação miofascial", subcategoria: "Quadril" },
        alvo,
      ),
    ).toBe(false);
  });

  it("respeita subcategoria informada como override", () => {
    const item = { grupo: "Preparação movimento", categoria: "Mobilidade Articular", subcategoria: "Quadril" };
    expect(itemCasaAlvo(item, alvo, "Glenoumeral")).toBe(false);
    expect(itemCasaAlvo(item, alvo, "Quadril")).toBe(true);
  });

  it("aceita registro legado sem categoria usando o grupo", () => {
    const legado = resolverAlvo("Força", tree);
    expect(itemCasaAlvo({ grupo: "Força", subcategoria: "Auxiliares" }, legado)).toBe(true);
  });
});
