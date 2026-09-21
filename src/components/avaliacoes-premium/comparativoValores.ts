import {
  ALL_FUNCTIONAL_METRICS,
  FORCA_EXERCICIO_LABEL,
  metricaInvertida,
  type ForcaExercicio,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";

export type LadoComparativo = "esquerdo" | "direito";
export type TomVariacao = "melhora" | "piora" | "neutro";
export type MovimentoMobilidade = "Perdeu amplitude" | "Ganhou amplitude" | "Sem mudança";
export type ResumoMobilidade = MovimentoMobilidade;
export type ResumoForca = "Perdeu força" | "Ganhou força" | "Estável";

export interface LadoMobilidadeComparativo {
  lado: LadoComparativo;
  antes: number | null;
  depois: number | null;
  variacao: number | null;
  movimento: MovimentoMobilidade | null;
  tom: TomVariacao;
}

export interface LinhaMobilidadeComparativo {
  metric: string;
  label: string;
  ordem: number;
  esquerdo: LadoMobilidadeComparativo;
  direito: LadoMobilidadeComparativo;
  resumo: ResumoMobilidade;
}

export interface LadoForcaComparativo {
  lado: LadoComparativo;
  antes: number | null;
  depois: number | null;
  variacaoPct: number | null;
  movimento: ResumoForca | null;
}

export interface LinhaForcaComparativo {
  nome: string;
  label: string;
  esquerdo: LadoForcaComparativo;
  direito: LadoForcaComparativo;
  resumo: ResumoForca;
}

export interface StatsComparativoValores {
  mobilidadeGanhou: number;
  mobilidadePerdeu: number;
  forcaGanhou: number;
  forcaPerdeu: number;
}

export const RESUMO_MOBILIDADE_ORDEM: Record<ResumoMobilidade, number> = {
  "Perdeu amplitude": 0,
  "Ganhou amplitude": 1,
  "Sem mudança": 2,
};

export const RESUMO_FORCA_ORDEM: Record<ResumoForca, number> = {
  "Perdeu força": 0,
  "Ganhou força": 1,
  Estável: 2,
};

// Provisório: deve ser definido pela equipe clínica a partir do erro de medição do dinamômetro.
export const CORTE_VARIACAO_FORCA_PCT = 5;

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function tomVariacaoMobilidade(metric: string, variacao: number | null | undefined): TomVariacao {
  if (!variacao) return "neutro";
  const melhora = metricaInvertida(metric) ? variacao < 0 : variacao > 0;
  return melhora ? "melhora" : "piora";
}

export function movimentoMobilidade(
  metric: string,
  variacao: number | null | undefined,
): MovimentoMobilidade | null {
  if (variacao === null || variacao === undefined || !Number.isFinite(variacao)) return null;
  const tom = tomVariacaoMobilidade(metric, variacao);
  if (tom === "melhora") return "Ganhou amplitude";
  if (tom === "piora") return "Perdeu amplitude";
  return "Sem mudança";
}

export function variacaoForcaPct(antes: number | null | undefined, depois: number | null | undefined): number | null {
  if (antes === null || antes === undefined || depois === null || depois === undefined) return null;
  if (!Number.isFinite(antes) || !Number.isFinite(depois) || antes === 0) return null;
  return ((depois - antes) / Math.abs(antes)) * 100;
}

export function movimentoForca(
  variacaoPct: number | null | undefined,
  cortePct = CORTE_VARIACAO_FORCA_PCT,
): ResumoForca | null {
  if (variacaoPct === null || variacaoPct === undefined || !Number.isFinite(variacaoPct)) return null;
  if (Math.abs(variacaoPct) < cortePct) return "Estável";
  return variacaoPct > 0 ? "Ganhou força" : "Perdeu força";
}

function resumoMobilidade(esquerdo: LadoMobilidadeComparativo, direito: LadoMobilidadeComparativo): ResumoMobilidade {
  if (esquerdo.movimento === "Perdeu amplitude" || direito.movimento === "Perdeu amplitude") return "Perdeu amplitude";
  if (esquerdo.movimento === "Ganhou amplitude" || direito.movimento === "Ganhou amplitude") return "Ganhou amplitude";
  return "Sem mudança";
}

function resumoForca(esquerdo: LadoForcaComparativo, direito: LadoForcaComparativo): ResumoForca {
  if (esquerdo.movimento === "Perdeu força" || direito.movimento === "Perdeu força") return "Perdeu força";
  if (esquerdo.movimento === "Ganhou força" || direito.movimento === "Ganhou força") return "Ganhou força";
  return "Estável";
}

function valorMetrica(snap: FuncionalSnapshot | null, metric: string, lado: "left" | "right"): number | null {
  const item = snap?.metricas.find((m) => m.metric === metric);
  return numero(item?.[lado]);
}

function montarLadoMobilidade(
  metric: string,
  lado: LadoComparativo,
  antesValor: number | null,
  depoisValor: number | null,
): LadoMobilidadeComparativo {
  const variacao = antesValor !== null && depoisValor !== null ? depoisValor - antesValor : null;
  return {
    lado,
    antes: antesValor,
    depois: depoisValor,
    variacao,
    movimento: movimentoMobilidade(metric, variacao),
    tom: tomVariacaoMobilidade(metric, variacao),
  };
}

export function ordenarMobilidadeComparativo(rows: LinhaMobilidadeComparativo[]): LinhaMobilidadeComparativo[] {
  return [...rows].sort((a, b) => {
    const grupo = RESUMO_MOBILIDADE_ORDEM[a.resumo] - RESUMO_MOBILIDADE_ORDEM[b.resumo];
    if (grupo !== 0) return grupo;
    return a.ordem - b.ordem;
  });
}

export function montarMobilidadeComparativo(
  antes: FuncionalSnapshot | null,
  depois: FuncionalSnapshot | null,
): LinhaMobilidadeComparativo[] {
  const rows = ALL_FUNCTIONAL_METRICS.map((metric, ordem) => {
    const esquerdo = montarLadoMobilidade(metric, "esquerdo", valorMetrica(antes, metric, "left"), valorMetrica(depois, metric, "left"));
    const direito = montarLadoMobilidade(metric, "direito", valorMetrica(antes, metric, "right"), valorMetrica(depois, metric, "right"));
    return {
      metric,
      label: metric,
      ordem,
      esquerdo,
      direito,
      resumo: resumoMobilidade(esquerdo, direito),
    };
  }).filter((row) => row.esquerdo.antes !== null || row.esquerdo.depois !== null || row.direito.antes !== null || row.direito.depois !== null);

  return ordenarMobilidadeComparativo(rows);
}

function montarLadoForca(
  lado: LadoComparativo,
  antes: number | null,
  depois: number | null,
): LadoForcaComparativo {
  const variacaoPct = variacaoForcaPct(antes, depois);
  return {
    lado,
    antes,
    depois,
    variacaoPct,
    movimento: movimentoForca(variacaoPct),
  };
}

export function ordenarForcaComparativo(rows: LinhaForcaComparativo[]): LinhaForcaComparativo[] {
  return [...rows].sort((a, b) => {
    const grupo = RESUMO_FORCA_ORDEM[a.resumo] - RESUMO_FORCA_ORDEM[b.resumo];
    if (grupo !== 0) return grupo;
    return a.label.localeCompare(b.label);
  });
}

export function montarForcaComparativo(
  antes: FuncionalSnapshot | null,
  depois: FuncionalSnapshot | null,
): LinhaForcaComparativo[] {
  const nomes = new Set<string>();
  antes?.forca.forEach((e) => nomes.add(e.nome));
  depois?.forca.forEach((e) => nomes.add(e.nome));

  const rows = Array.from(nomes).map((nome) => {
    const itemAntes = antes?.forca.find((e) => e.nome === nome) ?? null;
    const itemDepois = depois?.forca.find((e) => e.nome === nome) ?? null;
    const esquerdo = montarLadoForca("esquerdo", numero(itemAntes?.esquerdo_kg), numero(itemDepois?.esquerdo_kg));
    const direito = montarLadoForca("direito", numero(itemAntes?.direito_kg), numero(itemDepois?.direito_kg));
    return {
      nome,
      label: FORCA_EXERCICIO_LABEL[nome as ForcaExercicio] ?? nome,
      esquerdo,
      direito,
      resumo: resumoForca(esquerdo, direito),
    };
  }).filter((row) => row.esquerdo.movimento !== null || row.direito.movimento !== null);

  return ordenarForcaComparativo(rows);
}

export function calcularStatsComparativoValores(
  mobilidade: LinhaMobilidadeComparativo[],
  forca: LinhaForcaComparativo[],
): StatsComparativoValores {
  const ladosMobilidade = mobilidade.flatMap((row) => [row.esquerdo, row.direito]);
  const ladosForca = forca.flatMap((row) => [row.esquerdo, row.direito]);
  return {
    mobilidadeGanhou: ladosMobilidade.filter((lado) => lado.movimento === "Ganhou amplitude").length,
    mobilidadePerdeu: ladosMobilidade.filter((lado) => lado.movimento === "Perdeu amplitude").length,
    forcaGanhou: ladosForca.filter((lado) => lado.movimento === "Ganhou força").length,
    forcaPerdeu: ladosForca.filter((lado) => lado.movimento === "Perdeu força").length,
  };
}
