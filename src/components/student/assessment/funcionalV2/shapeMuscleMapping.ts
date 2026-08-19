import type { ForcaExercicio } from "./bodyMapLogic";

/**
 * Liga cada exercício de Força / métrica de Flexibilidade ao nome-base do músculo
 * (sem "-esquerdo"/"-direito" — isso é resolvido em tempo de render conforme o lado).
 * Esse vínculo fica no código (muda pouco); o CONTORNO de cada músculo é editado na
 * página de configuração e vive no banco (tabela bodymap_shapes).
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
  abducao_quadril: "gluteo",
  aducao_quadril: "adutor",
  // inversao: sem entrada de propósito — sem destaque visual.
};

export const FLEXIBILIDADE_SHAPE_MUSCLE: Record<string, string> = {
  "Flexibilidade Posterior MMII": "isquiotibiais",
  "Flexibilidade Quadríceps": "quadriceps",
  "Flexibilidade Psoas": "psoas",
};
