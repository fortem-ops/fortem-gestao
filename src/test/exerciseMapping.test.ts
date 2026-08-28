import { describe, it, expect } from "vitest";
import { resolverAlvo, itemCasaAlvo, categoriaEhFolha, type TaxonomiaGrupo } from "@/lib/exerciseMapping";

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

describe("categoriaEhFolha", () => {
  it("é folha quando há uma única subcategoria com o mesmo nome", () => {
    expect(categoriaEhFolha({ nome: "LPO", subcategorias: ["LPO"] })).toBe(true);
  });

  it("ignora acento e caixa na comparação", () => {
    expect(
      categoriaEhFolha({ nome: "Coordenativo Corrida", subcategorias: ["coordenativo corrida"] }),
    ).toBe(true);
    expect(categoriaEhFolha({ nome: "Pliometria", subcategorias: ["pliométria"] })).toBe(true);
  });

  it("não é folha com mais de uma subcategoria", () => {
    expect(categoriaEhFolha({ nome: "LPO", subcategorias: ["LPO", "Arranco"] })).toBe(false);
  });

  it("não é folha quando a subcategoria tem outro nome", () => {
    expect(categoriaEhFolha({ nome: "Força", subcategorias: ["Auxiliares"] })).toBe(false);
  });

  it("retorna false para categoria ausente", () => {
    expect(categoriaEhFolha(undefined)).toBe(false);
    expect(categoriaEhFolha(null)).toBe(false);
  });
});

const treeAtual: TaxonomiaGrupo[] = [
  {
    nome: "Aquecimento",
    categorias: [
      { nome: "Liberação Miofascial", sigla: "LIB", subcategorias: ["Pé/Tornozelo", "Perna"] },
      { nome: "Mobilidade Articular", sigla: "MOB", subcategorias: ["Quadril", "Torácica"] },
      { nome: "Ativação Muscular", sigla: "ATI", subcategorias: ["Glúteo"] },
      { nome: "Preventivo", sigla: "PREV", subcategorias: ["Ombro"] },
      { nome: "Potência", sigla: "POT", subcategorias: ["Saltos"] },
    ],
  },
  {
    nome: "Parte Principal",
    categorias: [
      { nome: "Força", subcategorias: ["Dominante de Joelho Simétrico", "Kettlebell", "LPO"] },
      { nome: "Potência", subcategorias: ["LPO"] },
      { nome: "Cardio", subcategorias: ["Cardio"] },
    ],
  },
];

describe("resolverAlvo — escopo Aquecimento x Parte Principal", () => {
  it("resolve sigla legada dentro de Aquecimento", () => {
    expect(resolverAlvo("LIB", treeAtual)).toMatchObject({
      grupo: "Aquecimento",
      categoria: "Liberação Miofascial",
    });
  });

  it("resolve nova categoria de aquecimento pela sigla dinâmica", () => {
    expect(resolverAlvo("POT", treeAtual, { grupoPreferido: "Aquecimento" })).toMatchObject({
      grupo: "Aquecimento",
      categoria: "Potência",
    });
  });

  it("resolve nome de categoria dentro do grupo preferido", () => {
    expect(resolverAlvo("Potência", treeAtual, { grupoPreferido: "Aquecimento" })).toMatchObject({
      grupo: "Aquecimento",
      categoria: "Potência",
    });
  });

  it("códigos de força apontam para Parte Principal > Força", () => {
    expect(resolverAlvo("DJS", treeAtual)).toMatchObject({
      grupo: "Parte Principal",
      categoria: "Força",
      subcategoria: "Dominante de Joelho Simétrico",
    });
    expect(resolverAlvo("KB", treeAtual)).toMatchObject({
      grupo: "Parte Principal",
      categoria: "Força",
      subcategoria: "Kettlebell",
    });
  });

  it("LPO resolve em Parte Principal > Potência", () => {
    expect(resolverAlvo("LPO", treeAtual)).toMatchObject({
      grupo: "Parte Principal",
      categoria: "Potência",
      subcategoria: "LPO",
    });
  });

  it("COND resolve em Parte Principal > Cardio", () => {
    expect(resolverAlvo("COND", treeAtual)).toMatchObject({
      grupo: "Parte Principal",
      categoria: "Cardio",
    });
  });
});
