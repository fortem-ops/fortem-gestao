import type { PremiumScores } from "./scoringPremium";
import type { ComposicaoSnapshot, FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";
import { FORCA_EXERCICIO_LABEL } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  gerarSugestoesAquecimento,
  type ExercicioSugerido,
  type ExercicioVinculado,
  type FaixaAssimetria,
} from "./aquecimentoSugestoes";

export interface Recomendacao {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  area: "mobilidade" | "flexibilidade" | "forca" | "composicao" | "fisioterapia" | "reavaliacao";
  /** Exercícios de aquecimento sugeridos (mobilidade/flexibilidade). */
  exercicios?: ExercicioSugerido[];
  /** Presente quando a recomendação nasce de uma assimetria com faixa. */
  assimetria?: { pct: number; faixa: FaixaAssimetria; lado: "esquerdo" | "direito"; chaveLabel: string };
}

export function gerarRecomendacoes(
  scores: PremiumScores,
  funcional: FuncionalSnapshot | null,
  composicao: ComposicaoSnapshot | null,
  exerciciosVinculados?: ExercicioVinculado[] | null,
): Recomendacao[] {
  const list: Recomendacao[] = [];

  // 1) Assimetrias severas de força (Kinology)
  (funcional?.forca ?? []).forEach((ex) => {
    const max = Math.max(ex.direito_kg, ex.esquerdo_kg);
    if (max <= 0) return;
    const diff = (Math.abs(ex.direito_kg - ex.esquerdo_kg) / max) * 100;
    const label = FORCA_EXERCICIO_LABEL[ex.nome] ?? ex.nome;
    if (diff >= 20) {
      list.push({
        id: `forca-${ex.nome}`,
        titulo: `Assimetria de força em ${label}`,
        descricao: `Diferença de ${diff.toFixed(0)}% entre lados. Priorizar fortalecimento unilateral do lado mais fraco e reavaliar em 8 semanas.`,
        prioridade: "alta",
        area: "forca",
      });
    } else if (diff >= 10) {
      list.push({
        id: `forca-${ex.nome}`,
        titulo: `Atenção: ${label}`,
        descricao: `Assimetria moderada (${diff.toFixed(0)}%). Incluir trabalho unilateral controlado nas próximas 4 semanas.`,
        prioridade: "media",
        area: "forca",
      });
    }
  });

  // 2) Mobilidade / Flexibilidade — assimetrias amarela (>=10%) e vermelha (>20%)
  //    com sugestão de exercícios de Aquecimento vinculados à articulação/músculo deficitário.
  gerarSugestoesAquecimento(funcional?.metricas, exerciciosVinculados).forEach((s) => {
    const areaLabel = s.area === "mobilidade" ? "Mobilidade" : "Flexibilidade";
    const vermelha = s.faixa === "vermelha";
    list.push({
      id: `${s.area === "mobilidade" ? "mob" : "flex"}-${s.metric}`,
      titulo: `${areaLabel}: ${s.label}`,
      descricao: `Assimetria de ${s.assimetriaPct.toFixed(0)}% — lado ${s.ladoDeficitario} deficitário (${s.chaveLabel}). ${
        vermelha
          ? "Priorizar aquecimento específico em toda sessão e reavaliar em 6 semanas."
          : "Incluir aquecimento específico 3x/semana e reavaliar em 8 semanas."
      }`,
      prioridade: vermelha ? "alta" : "media",
      area: s.area,
      exercicios: s.exercicios,
      assimetria: { pct: s.assimetriaPct, faixa: s.faixa, lado: s.ladoDeficitario, chaveLabel: s.chaveLabel },
    });
  });

  // 3) Déficits bilaterais (classificação absoluta) — cobrem o caso em que os dois lados
  //    estão igualmente ruins e, portanto, não geram assimetria.
  const ruim = (c: string | null | undefined) => c === "Fraco" || c === "Regular";
  (funcional?.metricas ?? []).forEach((m) => {
    if (/Mobilidade/i.test(m.metric) && (ruim(m.leftClass) || ruim(m.rightClass))) {
      const label = m.metric.replace(/^Mobilidade\s+/i, "");
      list.push({
        id: `mob-bilateral-${m.metric}`,
        titulo: `Mobilidade reduzida: ${label}`,
        descricao: "Amplitude abaixo do esperado. Aplicar protocolo de mobilidade específico 3x/semana e reavaliar em 6 semanas.",
        prioridade: ruim(m.leftClass) && ruim(m.rightClass) ? "alta" : "media",
        area: "mobilidade",
      });
    }
    if (/Flexibilidade/i.test(m.metric) && (m.leftClass === "Fraco" || m.rightClass === "Fraco")) {
      const label = m.metric.replace(/^Flexibilidade\s+/i, "");
      list.push({
        id: `flex-bilateral-${m.metric}`,
        titulo: `Flexibilidade crítica: ${label}`,
        descricao: "Adicionar alongamentos diários (45–60s) e técnica PNF 2x/semana.",
        prioridade: "media",
        area: "flexibilidade",
      });
    }
  });

  // 4) Composição corporal
  if (composicao) {
    if (scores.composicao !== null && scores.composicao < 55) {
      list.push({
        id: "comp-gordura",
        titulo: "Composição corporal acima do ideal",
        descricao: `${composicao.bf.toFixed(1)}% de gordura — combinar protocolo de treino metabólico e acompanhamento nutricional.`,
        prioridade: "media",
        area: "composicao",
      });
    }
  }

  // 5) Risco elevado → encaminhar fisio
  if (scores.risco !== null && scores.risco < 55) {
    list.push({
      id: "risco-fisio",
      titulo: "Encaminhamento à fisioterapia",
      descricao: `Quadro funcional com múltiplos déficits (índice de risco ${scores.risco}). Avaliar com fisioterapeuta antes de progressão de carga.`,
      prioridade: "alta",
      area: "fisioterapia",
    });
  }

  // 6) Reavaliação
  list.push({
    id: "reavaliar",
    titulo: "Próxima reavaliação",
    descricao: `Reavaliar em ${scores.risco !== null && scores.risco < 55 ? "45 dias" : "90 dias"} para acompanhamento da evolução funcional.`,
    prioridade: "baixa",
    area: "reavaliacao",
  });

  // dedupe por id
  const seen = new Set<string>();
  return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
