import type { ForcaExercicio } from "./bodyMapLogic";

/**
 * Liga cada exercício de Força / métrica de Flexibilidade ao nome-base do músculo
 * (sem "-esquerdo"/"-direito" — isso é resolvido em tempo de render conforme o lado).
 * O contorno de cada músculo é editado em Config. Mapa Corporal e vive no banco.
 */
export const FORCA_SHAPE_MUSCLE: Partial<Record<ForcaExercicio, string>> = {
  rotacao_interna: "deltoide",
  rotacao_externa: "deltoide-posterior",
  flexao_ombro: "deltoide",
  extensao_ombro: "deltoide-posterior",
  abducao_ombro: "deltoide",
  aducao_ombro: "deltoide",
  flexao_cotovelo: "biceps",
  extensao_cotovelo: "triceps",
  pronacao_antebraco: "antebraco-anterior",
  supinacao_antebraco: "antebraco-posterior",
  flexao_punho: "antebraco-anterior",
  extensao_punho: "antebraco-posterior",
  dorsiflexao: "tibial-anterior",
  flexao_plantar: "gastrocnemio",
  flexao_joelho: "isquiotibiais",
  extensao_joelho: "quadriceps",
  flexao_quadril: "psoas",
  extensao_quadril: "gluteo",
  abducao_quadril: "gluteo-medio",
  aducao_quadril: "adutor",
  // inversao: sem entrada de propósito — sem destaque visual.
};

export const FLEXIBILIDADE_SHAPE_MUSCLE: Record<string, string> = {
  "Flexibilidade Posterior MMII": "isquiotibiais",
  "Flexibilidade Quadríceps": "quadriceps",
  "Flexibilidade Psoas": "psoas",
};

/** Vínculo obrigatório das métricas de mobilidade às articulações calibráveis. */
export const MOBILIDADE_SHAPE_ARTICULATION: Record<string, { left?: string; right?: string; center?: string }> = {
  "Mobilidade Ombro RI": { left: "ombro-ri-esquerdo", right: "ombro-ri-direito" },
  "Mobilidade Ombro RE": { left: "ombro-re-esquerdo", right: "ombro-re-direito" },
  "Mobilidade Quadril RI": { left: "quadril-ri-esquerdo", right: "quadril-ri-direito" },
  "Mobilidade Quadril RE": { left: "quadril-re-esquerdo", right: "quadril-re-direito" },
  "Mobilidade Tornozelo": { left: "tornozelo-esquerdo", right: "tornozelo-direito" },
  "Mobilidade Torácica": { left: "toracica-esquerdo", right: "toracica-direito" },
};

export const MOBILIDADE_ARTICULATION_OPTIONS = [
  { key: "ombro-ri-esquerdo", label: "Ombro esquerdo — RI" },
  { key: "ombro-ri-direito", label: "Ombro direito — RI" },
  { key: "ombro-re-esquerdo", label: "Ombro esquerdo — RE" },
  { key: "ombro-re-direito", label: "Ombro direito — RE" },
  { key: "quadril-ri-esquerdo", label: "Quadril esquerdo — RI" },
  { key: "quadril-ri-direito", label: "Quadril direito — RI" },
  { key: "quadril-re-esquerdo", label: "Quadril esquerdo — RE" },
  { key: "quadril-re-direito", label: "Quadril direito — RE" },
  { key: "tornozelo-esquerdo", label: "Tornozelo esquerdo" },
  { key: "tornozelo-direito", label: "Tornozelo direito" },
  { key: "toracica-esquerdo", label: "Torácica esquerda" },
  { key: "toracica-direito", label: "Torácica direita" },
] as const;

/** Chaves E/D das métricas de flexibilidade, usadas no vínculo de exercícios e nas recomendações. */
export const FLEXIBILIDADE_SHAPE_KEYS: Record<string, { left: string; right: string }> = {
  "Flexibilidade Posterior MMII": { left: "posterior-coxa-esquerdo", right: "posterior-coxa-direito" },
  "Flexibilidade Quadríceps": { left: "quadriceps-esquerdo", right: "quadriceps-direito" },
  "Flexibilidade Psoas": { left: "psoas-esquerdo", right: "psoas-direito" },
};

export const FLEXIBILIDADE_MUSCULO_OPTIONS = [
  { key: "posterior-coxa-esquerdo", label: "Posterior de coxa esquerdo" },
  { key: "posterior-coxa-direito", label: "Posterior de coxa direito" },
  { key: "quadriceps-esquerdo", label: "Quadríceps esquerdo" },
  { key: "quadriceps-direito", label: "Quadríceps direito" },
  { key: "psoas-esquerdo", label: "Psoas esquerdo" },
  { key: "psoas-direito", label: "Psoas direito" },
] as const;

/** Todas as opções de vínculo (articulações + músculos de flexibilidade). */
export const ARTICULACAO_MUSCULO_OPTIONS = [
  ...MOBILIDADE_ARTICULATION_OPTIONS,
  ...FLEXIBILIDADE_MUSCULO_OPTIONS,
] as const;

export const ARTICULACAO_LABEL: Record<string, string> = Object.fromEntries(
  ARTICULACAO_MUSCULO_OPTIONS.map((o) => [o.key, o.label]),
);

/** Categorias de Aquecimento que podem receber vínculo com articulações/músculos. */
export const CATEGORIAS_COM_VINCULO = ["mobilidade articular", "liberação miofascial", "liberacao miofascial"];

export function categoriaAceitaVinculo(categoria: string | null | undefined): boolean {
  return CATEGORIAS_COM_VINCULO.includes((categoria ?? "").trim().toLowerCase());
}
