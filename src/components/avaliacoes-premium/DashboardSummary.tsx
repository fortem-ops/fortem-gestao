import { useMemo } from "react";
import { DashboardScoreCard } from "./DashboardScoreCard";
import { DashboardCountCard, DashboardRiscoCard } from "./DashboardCountCard";
import { bandFromScore, type PremiumScores } from "./scoringPremium";
import {
  classifyForca,
  contarAssimetriasPorFaixa,
  type ContagemAssimetrias,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";

export interface ForcaResumoInput {
  nome: string;
  direito_kg: number | null;
  esquerdo_kg: number | null;
}

interface Props {
  scores: PremiumScores;
  forca?: ForcaResumoInput[];
}

/** Percentuais de assimetria separados por categoria a partir do nome da métrica. */
export function assimetriasPorCategoria(scores: PremiumScores, forca: ForcaResumoInput[] = []) {
  const metricas = scores.analysisAsym?.metricAsymmetries ?? [];
  const mob = metricas.filter((m) => /^mobilidade/i.test(m.metric)).map((m) => m.diff);
  const flex = metricas.filter((m) => /^flexibilidade/i.test(m.metric)).map((m) => m.diff);
  const forcaPcts = forca
    .filter((e) => e.direito_kg != null && e.esquerdo_kg != null)
    .map((e) => classifyForca(e.direito_kg!, e.esquerdo_kg!).assimetria);

  return {
    mobilidade: contarAssimetriasPorFaixa(mob),
    flexibilidade: contarAssimetriasPorFaixa(flex),
    forca: contarAssimetriasPorFaixa(forcaPcts),
    geral: contarAssimetriasPorFaixa([...mob, ...flex, ...forcaPcts]),
  } satisfies Record<string, ContagemAssimetrias>;
}

export function DashboardSummary({ scores, forca = [] }: Props) {
  const j = scores.justificativas;
  const contagens = useMemo(() => assimetriasPorCategoria(scores, forca), [scores, forca]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <DashboardCountCard label="Mobilidade" contagem={contagens.mobilidade} simples />
      <DashboardCountCard label="Flexibilidade" contagem={contagens.flexibilidade} simples />
      <DashboardCountCard label="Força" contagem={contagens.forca} tooltip={j.forca} />
      <DashboardRiscoCard contagem={contagens.geral} />
      <DashboardScoreCard label="Composição" value={scores.composicao} subtle tooltip={j.composicao} />
    </div>

  );
}
