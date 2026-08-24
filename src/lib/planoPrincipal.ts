import { supabase } from "@/integrations/supabase/client";

/**
 * Atividade do plano "principal" do aluno (mensalidade de treinamento).
 * Planos paralelos (ex.: Corrida) NUNCA devem ser confundidos com este.
 */
export const ATIVIDADE_PRINCIPAL = "treinamento_funcional";

/**
 * Query canônica do plano principal ativo do aluno.
 *
 * Sempre use esta função em vez de montar a query inline — assim o filtro
 * `atividade = 'treinamento_funcional'` nunca é esquecido em código novo.
 *
 * Equivalente no banco: `public.fn_plano_principal_ativo(uuid)`.
 *
 * @param alunoId id do aluno
 * @param columns colunas a selecionar (default "*")
 */
export async function queryPlanoPrincipalAtivo(alunoId: string, columns = "*") {
  const res = await (supabase as any)
    .from("planos")
    .select(columns)
    .eq("aluno_id", alunoId)
    .eq("ativo", true)
    .eq("atividade", ATIVIDADE_PRINCIPAL)
    .order("created_at", { ascending: false });

  if (res.error) return { data: null, error: res.error };
  const escolhido = selecionarPlanoPrincipal((res.data as PlanoLike[]) ?? []);
  return { data: escolhido as any, error: null };
}

/** Versão que já devolve apenas o registro (ou null), ignorando o envelope. */
export async function getPlanoPrincipalAtivo<T = any>(
  alunoId: string,
  columns = "*",
): Promise<T | null> {
  const { data } = await queryPlanoPrincipalAtivo(alunoId, columns);
  return (data as T) ?? null;
}


/** Atividade dos planos paralelos de Corrida. */
export const ATIVIDADE_CORRIDA = "corrida";

export interface PlanoLike {
  id?: string;
  tipo?: string | null;
  atividade?: string | null;
  ativo?: boolean | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  duracao_meses?: number | null;
  created_at?: string | null;
}

/** Data final efetiva do plano (data_fim, ou início + duração). */
export function planoDataFim(plano: PlanoLike | null | undefined): Date | null {
  if (!plano) return null;
  if (plano.data_fim) return new Date(plano.data_fim + "T00:00:00");
  if (plano.data_inicio && plano.duracao_meses) {
    const d = new Date(plano.data_inicio + "T00:00:00");
    d.setMonth(d.getMonth() + plano.duracao_meses);
    return d;
  }
  return null;
}

function hoje(): Date {
  return new Date(new Date().toDateString());
}

/** Plano vigente = sem data final definida, ou data final >= hoje. */
export function planoVigente(plano: PlanoLike | null | undefined): boolean {
  if (!plano) return false;
  const fim = planoDataFim(plano);
  return !fim || fim >= hoje();
}

function porCreatedAtDesc(a: PlanoLike, b: PlanoLike) {
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

export interface PlanoExibicao {
  /** Plano que deve ser exibido nas telas (perfil, lista). */
  plano: PlanoLike | null;
  /** Plano principal (não-Corrida) vigente, se houver. */
  principalVigente: PlanoLike | null;
  /** Plano de Corrida vigente, se houver. */
  corridaVigente: PlanoLike | null;
  /** true quando só existe Corrida vigente (sem plano principal vigente). */
  corridaOnly: boolean;
}

/**
 * Seleção determinística de qual plano representa o aluno na interface.
 *
 * Prioridade: plano principal vigente → plano de Corrida vigente →
 * plano mais recente (fallback, por created_at desc).
 *
 * Use SEMPRE esta função para que perfil e listagem nunca divirjam.
 */
export function selecionarPlanoExibicao(planos: PlanoLike[] | null | undefined): PlanoExibicao {
  const ativos = (planos ?? []).filter((p) => p.ativo !== false).slice().sort(porCreatedAtDesc);

  const principais = ativos.filter((p) => p.atividade !== ATIVIDADE_CORRIDA);
  const corridas = ativos.filter((p) => p.atividade === ATIVIDADE_CORRIDA);

  const principalVigente = principais.find(planoVigente) ?? null;
  const corridaVigente = corridas.find(planoVigente) ?? null;

  const plano = principalVigente ?? corridaVigente ?? principais[0] ?? ativos[0] ?? null;

  return {
    plano,
    principalVigente,
    corridaVigente,
    corridaOnly: !principalVigente && !!corridaVigente,
  };
}


/**
 * Seleção canônica do plano PRINCIPAL (não-Corrida) de uma lista já carregada.
 * Prefere o vigente; se nenhum estiver vigente, devolve o mais recente
 * (por created_at desc) para que a tela mostre o vencimento em vez de "nenhum plano".
 */
export function selecionarPlanoPrincipal(
  planos: PlanoLike[] | null | undefined,
): PlanoLike | null {
  const principais = (planos ?? [])
    .filter((p) => p.ativo !== false && p.atividade !== ATIVIDADE_CORRIDA)
    .slice()
    .sort(porCreatedAtDesc);
  return principais.find(planoVigente) ?? principais[0] ?? null;
}
