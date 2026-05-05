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

/**
 * Resolve o valor armazenado em `ex.categoria` (pode ser um código curto
 * tipo "DJS" ou o nome de uma subcategoria criada pelo Coordenador) em
 * { grupo, subcategoria }. Consulta primeiro os mapas de código e, em
 * fallback, a taxonomia dinâmica vinda do banco.
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

