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
