// Map workout template category codes to Banco de Exercícios grupo/subcategoria
export const CODE_TO_GRUPO: Record<string, string> = {
  LIB: "Liberação Miofascial",
  MOB: "Mobilidade Articular",
  ATI: "Ativação Muscular",
  PREV: "Preventivo",
  COND: "Cardio",
  DJS: "Força",
  DJA: "Força",
  DQ: "Força",
  DQ_P: "Força",
  PH: "Força",
  PV: "Força",
  EH: "Força",
  EV: "Força",
  EP: "Força",
  EEF: "Força",
  EE: "Força",
  AH: "Força",
  AF: "Força",
  AR: "Força",
  ROT: "Força",
  KB: "Força",
  PLIO: "Força",
  ISO: "Força",
  ABD: "Força",
  ET: "Força",
  LPO: "Força",
  AUX: "Força",
};

export const CODE_TO_SUBCATEGORIA: Record<string, string | undefined> = {
  DJS: "Dominante de Joelho Simétrico",
  DJA: "Dominante de Joelhos Assimétrico",
  DQ: "Dominante de Quadril",
  DQ_P: "Dominante de Quadril Posterior",
  PH: "Puxar Horizontal",
  PV: "Puxar Vertical",
  EH: "Empurrar Horizontal",
  EV: "Empurrar Vertical",
  EP: "Estabilidade Posterior",
  EEF: "Estabilidade Escapular",
  EE: "Estabilidade Escapular",
  AH: "Anti-Hiperextensão",
  AF: "Anti-flexão",
  AR: "Anti-Rotação",
  ROT: "Rotação",
  KB: "Kettlebell",
  PLIO: "Pliometria",
  ISO: "Isoinercial",
  ABD: "Abdominais",
  ET: "Extensão Torácica",
  LPO: "LPO",
  AUX: "Auxiliares",
};

// Inverso de CODE_TO_SUBCATEGORIA (nome → primeiro código). Usado para preservar
// o código curto em templates quando o usuário escolhe uma subcategoria conhecida.
export const SUBCATEGORIA_TO_CODE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [code, name] of Object.entries(CODE_TO_SUBCATEGORIA)) {
    if (!name) continue;
    if (!(name in out)) out[name] = code;
  }
  return out;
})();

export interface CategoriaTaxonomia {
  name: string;
  subcategories: string[];
}

/** Blocos de aquecimento: hoje são CATEGORIAS (nível 2), não grupos. */
export const CODE_TO_CATEGORIA: Record<string, string> = {
  LIB: "Liberação Miofascial",
  MOB: "Mobilidade Articular",
  ATI: "Ativação Muscular",
  PREV: "Preventivo",
};

/** Árvore de 3 níveis vinda de useExerciseCategories().tree */
export interface TaxonomiaCategoria {
  nome: string;
  subcategorias: string[];
}
export interface TaxonomiaGrupo {
  nome: string;
  categorias: TaxonomiaCategoria[];
}

export interface AlvoExercicio {
  grupo?: string;
  categoria?: string;
  subcategoria?: string;
  /** Nome mais específico resolvido, para exibição. */
  label: string;
}

const eq = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const norm = (s?: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/**
 * Categoria "folha": tem uma única subcategoria com o mesmo nome dela.
 * Nesses casos o 3º nível é redundante e não deve aparecer na navegação.
 */
export function categoriaEhFolha(categoria?: TaxonomiaCategoria | null): boolean {
  if (!categoria) return false;
  return (
    categoria.subcategorias.length === 1 &&
    norm(categoria.subcategorias[0]) === norm(categoria.nome)
  );
}

function acharCategoria(nome: string, tree: TaxonomiaGrupo[]) {
  for (const g of tree) {
    const c = g.categorias.find((x) => eq(x.nome, nome));
    if (c) return { grupo: g.nome, categoria: c.nome };
  }
  return null;
}

function acharSub(nome: string, tree: TaxonomiaGrupo[], grupoPref?: string, catPref?: string) {
  const candidatos: { grupo: string; categoria: string }[] = [];
  for (const g of tree) {
    for (const c of g.categorias) {
      if (c.subcategorias.some((s) => eq(s, nome))) {
        candidatos.push({ grupo: g.nome, categoria: c.nome });
      }
    }
  }
  if (candidatos.length === 0) return null;
  return (
    candidatos.find((c) => (!grupoPref || eq(c.grupo, grupoPref)) && (!catPref || eq(c.categoria, catPref))) ??
    candidatos.find((c) => !grupoPref || eq(c.grupo, grupoPref)) ??
    candidatos[0]
  );
}

/**
 * Resolve o valor armazenado em `ex.categoria` (código curto tipo "DJS",
 * nome de categoria ou nome de subcategoria) contra a taxonomia de
 * 3 níveis, devolvendo os níveis conhecidos.
 */
export function resolverAlvo(
  value: string | undefined | null,
  tree: TaxonomiaGrupo[],
): AlvoExercicio {
  if (!value) return { label: "" };
  const upper = value.toUpperCase();

  // 1) blocos de aquecimento → categoria
  const catCode = CODE_TO_CATEGORIA[upper];
  if (catCode) {
    const achado = acharCategoria(catCode, tree);
    if (achado) return { ...achado, label: achado.categoria };
    // fallback legado: ainda existe como grupo
    return { grupo: catCode, label: catCode };
  }

  // 2) códigos de força → grupo + subcategoria
  const grupoCode = CODE_TO_GRUPO[upper];
  if (grupoCode) {
    const sub = CODE_TO_SUBCATEGORIA[upper];
    if (sub) {
      const achado = acharSub(sub, tree, grupoCode);
      if (achado) return { ...achado, subcategoria: sub, label: sub };
      return { grupo: grupoCode, subcategoria: sub, label: sub };
    }
    const asGrupo = tree.find((g) => eq(g.nome, grupoCode));
    if (asGrupo) return { grupo: asGrupo.nome, label: asGrupo.nome };
    const asCat = acharCategoria(grupoCode, tree);
    if (asCat) return { ...asCat, label: asCat.categoria };
    return { grupo: grupoCode, label: grupoCode };
  }

  // 3) nome livre: subcategoria → categoria → grupo
  const asSub = acharSub(value, tree);
  if (asSub) return { ...asSub, subcategoria: value, label: value };
  const asCat = acharCategoria(value, tree);
  if (asCat) return { ...asCat, label: asCat.categoria };
  const asGrupo = tree.find((g) => eq(g.nome, value));
  if (asGrupo) return { grupo: asGrupo.nome, label: asGrupo.nome };
  return { grupo: value, label: value };
}

export interface ItemGrupoExercicio {
  grupo: string;
  categoria?: string;
  subcategoria?: string;
}

/** Um item do JSON `grupos` do exercício casa com o alvo resolvido? */
export function itemCasaAlvo(
  item: ItemGrupoExercicio,
  alvo: AlvoExercicio,
  subOverride?: string,
): boolean {
  const cat = item.categoria ?? item.grupo;
  if (alvo.grupo && !eq(item.grupo, alvo.grupo)) return false;
  if (alvo.categoria && !eq(cat, alvo.categoria)) return false;
  const sub = subOverride ?? alvo.subcategoria;
  if (sub && !eq(item.subcategoria, sub)) return false;
  return true;
}

/**
 * Wrapper legado (2 níveis). Mantido para chamadas antigas.
 */
export function categoriaToGrupoSub(
  value: string | undefined | null,
  categories: CategoriaTaxonomia[],
): { grupo: string; subcategoria?: string } {
  if (!value) return { grupo: "" };
  const upper = value.toUpperCase();
  if (CODE_TO_GRUPO[upper]) {
    return { grupo: CODE_TO_GRUPO[upper], subcategoria: CODE_TO_SUBCATEGORIA[upper] };
  }
  for (const c of categories) {
    if (c.subcategories.includes(value)) {
      return { grupo: c.name, subcategoria: value };
    }
  }
  const asGroup = categories.find((c) => c.name === value);
  if (asGroup) return { grupo: asGroup.name };
  return { grupo: value };
}

// GRUPO_SUBCATEGORIAS e AQUECIMENTO_SUBCATEGORIAS foram removidos.
// A taxonomia agora vem do banco via useExerciseCategories().


