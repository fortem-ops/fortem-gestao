// Helpers puros da reorganização do portal do aluno (Etapa 1).

export interface ParceiroPublicoRow {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  logo_url: string | null;
  ativo: boolean | null;
}

export interface BeneficioParceiroRow {
  id: string;
  parceiro_id: string;
  titulo: string;
  regra_uso: string | null;
  ativo: boolean;
}

export interface ParceiroComBeneficios extends ParceiroPublicoRow {
  beneficios: BeneficioParceiroRow[];
}

/** Filtra parceiros ativos que possuem ao menos 1 benefício ativo, ordenados por nome. */
export function montarParceirosAtivosComBeneficios(
  parceiros: ParceiroPublicoRow[],
  beneficios: BeneficioParceiroRow[],
): ParceiroComBeneficios[] {
  const porParceiro = new Map<string, BeneficioParceiroRow[]>();
  for (const b of beneficios) {
    if (!b.ativo) continue;
    const lista = porParceiro.get(b.parceiro_id) ?? [];
    lista.push(b);
    porParceiro.set(b.parceiro_id, lista);
  }
  return parceiros
    .filter((p) => p.ativo !== false && (porParceiro.get(p.id)?.length ?? 0) > 0)
    .map((p) => ({
      ...p,
      categoria: p.categoria?.trim() || "Outros",
      beneficios: porParceiro.get(p.id) ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Filtra parceiros por texto (nome ou categoria) e categoria selecionada. */
export function filtrarParceiros(
  lista: ParceiroComBeneficios[],
  busca: string,
  categoria: string,
): ParceiroComBeneficios[] {
  const termo = busca.trim().toLowerCase();
  return lista.filter((p) => {
    if (categoria && categoria !== "todas" && (p.categoria ?? "Outros") !== categoria) return false;
    if (!termo) return true;
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.categoria ?? "").toLowerCase().includes(termo) ||
      p.beneficios.some((b) => b.titulo.toLowerCase().includes(termo))
    );
  });
}

/** Conta dias distintos com treino realizado em um mês (aaaa-mm). */
export function contarDiasComTreinoNoMes(datas: string[], mesIso: string): number {
  const dias = new Set<string>();
  for (const d of datas) {
    const dia = d.slice(0, 10);
    if (dia.startsWith(mesIso)) dias.add(dia);
  }
  return dias.size;
}

/** Retorna uma única linha de recompensa para o desafio coletivo, sem duplicação. */
export function textoRecompensaDesafio(d: {
  mensagem_recompensa?: string | null;
  pontos_recompensa?: number | null;
}): string | null {
  const msg = d.mensagem_recompensa?.trim();
  if (msg) return msg;
  if ((d.pontos_recompensa ?? 0) > 0) {
    return `Ao atingir a meta, todos os alunos ativos recebem ${d.pontos_recompensa} pontos.`;
  }
  return null;
}

export type GrupoConquistaId = "treinos" | "nutricao_reab" | "avaliacao_fortem";

export interface BadgePortal {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  criterio?: string | null;
  conquistado: boolean;
  conquistado_em?: string | null;
}

export const GRUPOS_CONQUISTAS: { id: GrupoConquistaId; titulo: string }[] = [
  { id: "treinos", titulo: "Treinos" },
  { id: "nutricao_reab", titulo: "Nutrição e reabilitação" },
  { id: "avaliacao_fortem", titulo: "Avaliação e FORTEM" },
];

export function grupoDaConquista(codigo: string): GrupoConquistaId {
  if (codigo.startsWith("nutri_") || codigo.startsWith("reab_")) return "nutricao_reab";
  if (
    codigo.startsWith("avaliacao_") ||
    codigo === "fortem_completo" ||
    codigo === "embaixador" ||
    codigo === "veterano" ||
    codigo === "lenda"
  ) {
    return "avaliacao_fortem";
  }
  return "treinos";
}

const METAS_TREINOS: Record<string, number> = {
  primeiro_treino: 1,
  treinos_10: 10,
  treinos_50: 50,
  treinos_100: 100,
  treinos_250: 250,
  treinos_500: 500,
};

const METAS_SEMANAS: Record<string, number> = {
  sequencia_30: 8,
  semanas_16: 16,
};

/** Calcula com segurança a conquista bloqueada mais próxima (somente metas numéricas conhecidas). */
export function calcularProximaConquista(
  badges: BadgePortal[],
  totalTreinos: number,
  semanasSeguidas: number,
  consultoria: boolean,
): { nome: string; faltam: number } | null {
  let melhor: { nome: string; faltam: number } | null = null;
  for (const b of badges) {
    if (b.conquistado) continue;
    let faltam: number | null = null;
    if (b.codigo in METAS_TREINOS) {
      faltam = METAS_TREINOS[b.codigo] - totalTreinos;
    } else if (!consultoria && b.codigo in METAS_SEMANAS) {
      faltam = METAS_SEMANAS[b.codigo] - semanasSeguidas;
    }
    if (faltam !== null && faltam > 0) {
      if (!melhor || faltam < melhor.faltam) {
        melhor = { nome: b.nome, faltam };
      }
    }
  }
  return melhor;
}

/** Resolve redirecionamento da rota antiga /portal/meu-perfil?aba=... */
export function resolverDestinoMeuPerfil(aba: string | null): string {
  if (aba === "conquistas") return "/portal/avaliacoes?aba=conquistas";
  if (aba === "clubes") return "/portal/comunidade?aba=clubes";
  return "/portal/avaliacoes?aba=frequencia";
}