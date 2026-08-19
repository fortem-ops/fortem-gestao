import type { ForcaExercicio } from "./bodyMapLogic";
import type { MuscleKey } from "./muscleShapes";

export interface ShapePlacement {
  muscle: MuscleKey;
  view: "front" | "back";
  /** Posição/escala inicial — provavelmente precisa de ajuste manual via Modo calibração,
   * já que a forma veio de uma ilustração com proporções diferentes da nossa imagem. */
  cx: number;
  cy: number;
  scale: number;
}

export const FORCA_SHAPE_PLACEMENT: Partial<Record<ForcaExercicio, ShapePlacement>> = {
  rotacao_interna: { muscle: "deltoide", view: "front", cx: 512, cy: 260, scale: 1.6 },
  rotacao_externa: { muscle: "deltoide", view: "back", cx: 512, cy: 270, scale: 1.6 },
  flexao_ombro: { muscle: "deltoide", view: "front", cx: 512, cy: 260, scale: 1.6 },
  extensao_ombro: { muscle: "deltoide", view: "back", cx: 512, cy: 270, scale: 1.6 },
  abducao_ombro: { muscle: "deltoide", view: "front", cx: 512, cy: 260, scale: 1.6 },
  aducao_ombro: { muscle: "deltoide", view: "front", cx: 512, cy: 260, scale: 1.6 },
  flexao_cotovelo: { muscle: "biceps", view: "front", cx: 512, cy: 400, scale: 1.6 },
  extensao_cotovelo: { muscle: "triceps", view: "back", cx: 512, cy: 400, scale: 1.6 },
  pronacao_antebraco: { muscle: "antebraco-anterior", view: "front", cx: 512, cy: 540, scale: 1.6 },
  supinacao_antebraco: { muscle: "antebraco-posterior", view: "back", cx: 512, cy: 540, scale: 1.6 },
  flexao_punho: { muscle: "antebraco-anterior", view: "front", cx: 512, cy: 540, scale: 1.6 },
  extensao_punho: { muscle: "antebraco-posterior", view: "back", cx: 512, cy: 540, scale: 1.6 },
  dorsiflexao: { muscle: "tibial-anterior", view: "front", cx: 512, cy: 840, scale: 1.6 },
  flexao_plantar: { muscle: "gastrocnemio", view: "back", cx: 512, cy: 840, scale: 1.6 },
  flexao_joelho: { muscle: "isquiotibiais", view: "back", cx: 512, cy: 700, scale: 1.6 },
  extensao_joelho: { muscle: "quadriceps", view: "front", cx: 512, cy: 700, scale: 1.6 },
  flexao_quadril: { muscle: "psoas", view: "front", cx: 512, cy: 600, scale: 1.6 },
  extensao_quadril: { muscle: "gluteo", view: "back", cx: 512, cy: 550, scale: 1.6 },
  abducao_quadril: { muscle: "gluteo", view: "back", cx: 512, cy: 550, scale: 1.6 },
  aducao_quadril: { muscle: "adutor", view: "front", cx: 512, cy: 600, scale: 1.6 },
  // inversao: sem entrada de propósito — sem destaque visual (decisão já combinada).
};

export const FLEXIBILIDADE_SHAPE_PLACEMENT: Record<string, ShapePlacement> = {
  "Flexibilidade Posterior MMII": { muscle: "isquiotibiais", view: "back", cx: 512, cy: 700, scale: 1.6 },
  "Flexibilidade Quadríceps": { muscle: "quadriceps", view: "front", cx: 512, cy: 700, scale: 1.6 },
  "Flexibilidade Psoas": { muscle: "psoas", view: "front", cx: 512, cy: 600, scale: 1.6 },
};
