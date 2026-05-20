import { DashboardScoreCard } from "./DashboardScoreCard";
import { bandFromScore, type PremiumScores } from "./scoringPremium";

interface Props {
  scores: PremiumScores;
}

export function DashboardSummary({ scores }: Props) {
  const riscoBand =
    scores.risco === null
      ? "none"
      : scores.risco >= 75
      ? "good"
      : scores.risco >= 55
      ? "warn"
      : "risk";

  const j = scores.justificativas;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      <DashboardScoreCard
        label="Índice Fortem"
        value={scores.indiceFortem}
        unit="/100"
        band={bandFromScore(scores.indiceFortem)}
        tooltip={j.indiceFortem}
      />
      <DashboardScoreCard label="Mobilidade" value={scores.mobilidade} subtle tooltip={j.mobilidade} />
      <DashboardScoreCard label="Força" value={scores.forca} subtle tooltip={j.forca} />
      <DashboardScoreCard label="Flexibilidade" value={scores.flexibilidade} subtle tooltip={j.flexibilidade} />
      <DashboardScoreCard label="Composição" value={scores.composicao} subtle tooltip={j.composicao} />
      <DashboardScoreCard label="Simetria" value={scores.assimetria} subtle tooltip={j.assimetria} />
      <DashboardScoreCard
        label="Risco de Lesão"
        value={scores.risco}
        band={riscoBand}
        tooltip={j.risco}
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
