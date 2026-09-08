import type { MetricInput } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { getMetricDisplayLabel } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  ARTICULACAO_LABEL,
  FLEXIBILIDADE_SHAPE_KEYS,
  MOBILIDADE_SHAPE_ARTICULATION,
} from "@/components/student/assessment/funcionalV2/shapeMuscleMapping";

export interface ExercicioVinculado {
  id: string;
  nome: string;
  video_url: string | null;
  categoria: string | null;
  articulacoes: string[];
}

export interface ExercicioSugerido {
  id: string;
  nome: string;
  video_url: string | null;
  categoria: string | null;
  /** Lado do vínculo que motivou a sugestão. */
  lado: "esquerdo" | "direito";
}

export type FaixaAssimetria = "amarela" | "vermelha";

export interface SugestaoAquecimento {
  metric: string;
  /** Rótulo amigável sem prefixo de camada. */
  label: string;
  area: "mobilidade" | "flexibilidade";
  assimetriaPct: number;
  faixa: FaixaAssimetria;
  ladoDeficitario: "esquerdo" | "direito";
  /** Chave do lado deficitário (ex.: ombro-ri-esquerdo). */
  chaveDeficitaria: string;
  chaveLabel: string;
  exercicios: ExercicioSugerido[];
}

/** Métricas em que valor menor = melhor (invertidas). */
const METRICAS_INVERTIDAS = new Set(["Flexibilidade Psoas"]);

export function calcularAssimetriaPct(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  const max = Math.max(Math.abs(left), Math.abs(right));
  if (max <= 0) return null;
  return (Math.abs(left - right) / max) * 100;
}

export function faixaAssimetria(pct: number): FaixaAssimetria | null {
  if (pct > 20) return "vermelha";
  if (pct >= 10) return "amarela";
  return null;
}

function chavesDaMetrica(metric: string): { left: string; right: string; area: "mobilidade" | "flexibilidade" } | null {
  const mob = MOBILIDADE_SHAPE_ARTICULATION[metric];
  if (mob?.left && mob.right) return { left: mob.left, right: mob.right, area: "mobilidade" };
  const flex = FLEXIBILIDADE_SHAPE_KEYS[metric];
  if (flex) return { ...flex, area: "flexibilidade" };
  return null;
}

function limparLabel(metric: string): string {
  return getMetricDisplayLabel(metric).replace(/^(Mobilidade|Flexibilidade)\s+/i, "");
}

/**
 * Gera sugestões de exercícios de Aquecimento para métricas de mobilidade/flexibilidade
 * com assimetria na faixa amarela (>=10%) ou vermelha (>20%).
 * Somente exercícios vinculados à chave do lado deficitário são sugeridos, sem repetição.
 */
export function gerarSugestoesAquecimento(
  metricas: MetricInput[] | null | undefined,
  exercicios: ExercicioVinculado[] | null | undefined,
): SugestaoAquecimento[] {
  const out: SugestaoAquecimento[] = [];
  for (const m of metricas ?? []) {
    const chaves = chavesDaMetrica(m.metric);
    if (!chaves) continue;
    const pct = calcularAssimetriaPct(m.left, m.right);
    if (pct === null) continue;
    const faixa = faixaAssimetria(pct);
    if (!faixa) continue;

    const invertida = METRICAS_INVERTIDAS.has(m.metric);
    const l = m.left as number;
    const r = m.right as number;
    // Deficitário = menor valor (ou maior, quando a métrica é invertida).
    const ladoDeficitario: "esquerdo" | "direito" = invertida ? (l > r ? "esquerdo" : "direito") : l < r ? "esquerdo" : "direito";
    const chave = ladoDeficitario === "esquerdo" ? chaves.left : chaves.right;

    const seen = new Set<string>();
    const sugeridos: ExercicioSugerido[] = [];
    for (const ex of exercicios ?? []) {
      if (seen.has(ex.id) || !ex.articulacoes.includes(chave)) continue;
      seen.add(ex.id);
      sugeridos.push({ id: ex.id, nome: ex.nome, video_url: ex.video_url, categoria: ex.categoria, lado: ladoDeficitario });
    }
    sugeridos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    out.push({
      metric: m.metric,
      label: limparLabel(m.metric),
      area: chaves.area,
      assimetriaPct: pct,
      faixa,
      ladoDeficitario,
      chaveDeficitaria: chave,
      chaveLabel: ARTICULACAO_LABEL[chave] ?? chave,
      exercicios: sugeridos,
    });
  }
  return out.sort((a, b) => b.assimetriaPct - a.assimetriaPct);
}
