export type MuscleKey =
  | "deltoide" | "biceps" | "triceps" | "antebraco-anterior" | "antebraco-posterior"
  | "quadriceps" | "isquiotibiais" | "adutor" | "gluteo" | "tibial-anterior" | "gastrocnemio" | "psoas";

interface MusclePaths {
  esquerdo: string;
  direito: string;
}

/**
 * Contornos reais extraídos de referência anatômica (não são aproximações desenhadas à mão).
 * Coordenadas locais num espaço ~0-310 (largura) x ~0-900 (altura), centro de referência em
 * MUSCLE_SHAPE_ORIGIN. Usadas via <path> com transform (translate + scale) em BodyMapSVG.
 */
export const MUSCLE_SHAPES: Record<MuscleKey, MusclePaths> = {
  deltoide: {
    esquerdo: "M76 165 Q105 128 132 166 Q116 218 73 215 Q55 190 76 165 Z",
    direito: "M264 165 Q235 128 208 166 Q224 218 267 215 Q285 190 264 165 Z",
  },
  biceps: {
    esquerdo: "M68 235 Q96 230 103 285 Q93 350 63 375 Q50 305 68 235 Z",
    direito: "M272 235 Q244 230 237 285 Q247 350 277 375 Q290 305 272 235 Z",
  },
  triceps: {
    esquerdo: "M68 245 Q100 255 99 365 Q83 420 58 390 Q50 315 68 245 Z",
    direito: "M272 245 Q240 255 241 365 Q257 420 282 390 Q290 315 272 245 Z",
  },
  "antebraco-anterior": {
    esquerdo: "M58 370 Q90 385 96 520 L62 530 Q42 440 58 370 Z",
    direito: "M282 370 Q250 385 244 520 L278 530 Q298 440 282 370 Z",
  },
  "antebraco-posterior": {
    esquerdo: "M58 370 Q90 385 96 520 L62 530 Q42 440 58 370 Z",
    direito: "M282 370 Q250 385 244 520 L278 530 Q298 440 282 370 Z",
  },
  quadriceps: {
    esquerdo: "M112 465 Q90 590 112 725 Q145 745 160 705 Q158 575 165 462 Z",
    direito: "M228 465 Q250 590 228 725 Q195 745 180 705 Q182 575 175 462 Z",
  },
  isquiotibiais: {
    esquerdo: "M112 560 Q155 575 154 735 Q120 760 100 725 Q95 635 112 560 Z",
    direito: "M228 560 Q185 575 186 735 Q220 760 240 725 Q245 635 228 560 Z",
  },
  adutor: {
    esquerdo: "M145 450 Q165 465 160 685 Q138 625 126 480 Z",
    direito: "M195 450 Q175 465 180 685 Q202 625 214 480 Z",
  },
  gluteo: {
    esquerdo: "M105 440 Q150 405 166 460 Q160 535 112 555 Q85 510 105 440 Z",
    direito: "M235 440 Q190 405 174 460 Q180 535 228 555 Q255 510 235 440 Z",
  },
  "tibial-anterior": {
    esquerdo: "M115 760 Q145 780 148 880 L112 882 Q96 815 115 760 Z",
    direito: "M225 760 Q195 780 192 880 L228 882 Q244 815 225 760 Z",
  },
  gastrocnemio: {
    esquerdo: "M110 745 Q150 765 145 870 Q105 880 98 800 Z",
    direito: "M230 745 Q190 765 195 870 Q235 880 242 800 Z",
  },
  psoas: {
    // Aproximação — músculo profundo, sem contorno de superfície na referência.
    // Pequena forma afunilada na prega do quadril/virilha; ajustar via calibração.
    esquerdo: "M158 445 Q148 455 150 472 Q155 480 162 472 Q166 455 158 445 Z",
    direito: "M182 445 Q192 455 190 472 Q185 480 178 472 Q174 455 182 445 Z",
  },
};

/** Ponto de referência (centro aproximado) no espaço de coordenadas local das formas acima. */
export const MUSCLE_SHAPE_ORIGIN = { x: 170, y: 450 };
