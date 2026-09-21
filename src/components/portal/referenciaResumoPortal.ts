import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REF_MIN_AMOSTRA } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { FaixaEtaria } from "@/lib/faixaEtaria";

/** Resumo agregado de uma métrica/sexo/faixa da base Fortem (sem linhas individuais). */
export interface ResumoReferencia {
  n: number;
  media: number;
  desvio: number;
}

export type FaixaResumo = FaixaEtaria | "todos";

export type ResumoReferenciaBucket = Partial<Record<FaixaResumo, ResumoReferencia>>;

export type ResumoReferenciaPortal = Record<
  string,
  { M: ResumoReferenciaBucket; F: ResumoReferenciaBucket }
>;

/**
 * Mesma regra de `arrayReferencia`: usa a faixa etária quando tem amostra
 * suficiente (n >= REF_MIN_AMOSTRA), senão cai no grupo "todos" (também sujeito
 * ao corte mínimo). Sem nenhum dos dois, não há curva para a métrica.
 */
export function escolherResumoReferencia(
  bucket: ResumoReferenciaBucket | undefined,
  faixa?: FaixaEtaria | null,
): ResumoReferencia | null {
  if (!bucket) return null;
  if (faixa) {
    const daFaixa = bucket[faixa];
    if (daFaixa && daFaixa.n >= REF_MIN_AMOSTRA) return daFaixa;
  }
  const todos = bucket.todos;
  return todos && todos.n >= REF_MIN_AMOSTRA ? todos : null;
}

interface LinhaResumo {
  metrica: string;
  sexo: string;
  faixa: string;
  n: number;
  media: number | string;
  desvio: number | string;
}

export function montarResumoReferencia(linhas: LinhaResumo[]): ResumoReferenciaPortal {
  const resumo: ResumoReferenciaPortal = {};
  for (const linha of linhas) {
    const porMetrica = (resumo[linha.metrica] ??= { M: {}, F: {} });
    const porSexo = porMetrica[linha.sexo as "M" | "F"];
    if (!porSexo) continue;
    porSexo[linha.faixa as FaixaResumo] = {
      n: Number(linha.n),
      media: Number(linha.media),
      desvio: Number(linha.desvio),
    };
  }
  return resumo;
}

/** Resumo da base Fortem acessível ao aluno (função agregada no banco). */
export function useMobilidadeResumoReferencia() {
  return useQuery<ResumoReferenciaPortal>({
    queryKey: ["mobilidade-referencia-resumo"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_mobilidade_referencia_resumo");
      if (error) throw error;
      return montarResumoReferencia((data ?? []) as LinhaResumo[]);
    },
  });
}
