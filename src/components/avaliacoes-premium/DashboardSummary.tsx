import { DashboardScoreCard } from "./DashboardScoreCard";
import { bandFromScore, type PremiumScores } from "./scoringPremium";

interface Props {
  scores: PremiumScores;
}

export function DashboardSummary({ scores }: Props) {
  // Para "Risco" mostramos como percentil seguro (100 = baixo risco).
  // O label/banda ficam invertidos para deixar visualmente coerente.
  const riscoBand =
    scores.risco === null
      ? "none"
      : scores.risco >= 75
      ? "good"
      : scores.risco >= 55
      ? "warn"
      : "risk";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      <DashboardScoreCard
        label="Índice Fortem"
        value={scores.indiceFortem}
        unit="/100"
        band={bandFromScore(scores.indiceFortem)}
      />
      <DashboardScoreCard label="Mobilidade" value={scores.mobilidade} subtle />
      <DashboardScoreCard label="Força" value={scores.forca} subtle />
      <DashboardScoreCard label="Flexibilidade" value={scores.flexibilidade} subtle />
      <DashboardScoreCard label="Composição" value={scores.composicao} subtle />
      <DashboardScoreCard label="Simetria" value={scores.assimetria} subtle />
      <DashboardScoreCard
        label="Risco de Lesão"
        value={scores.risco}
        band={riscoBand}
        statusLabel={
          scores.risco === null
            ? "Sem dado"
            : scores.risco >= 75
            ? "Baixo"
            : scores.risco >= 55
            ? "Atenção"
            : "Alto"
        }
      />
    </div>
  );
}
