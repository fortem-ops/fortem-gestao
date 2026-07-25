/**
 * Método 5-3-1 (Jim Wendler) — cálculo de ondas e tipos de persistência.
 *
 * Regras validadas com o gestor:
 * - Training Max = 1RM × percentual_training_max (uma única % por prescrição).
 * - Cargas arredondadas ao múltiplo de 2,5kg MAIS PRÓXIMO.
 * - Onda semanal fixa (não editável):
 *   Semanas 1-3 → aquecimento 40/50/60% (5 reps) + trabalho:
 *     Semana 1: 65/75/85%  (5, 5, 5+)
 *     Semana 2: 70/80/90%  (5, 3, 3+)
 *     Semana 3: 75/85/95%  (5, 3, 1+)
 *   Semana 4 (deload): 40/50/60/60/60/60% (todas 5 reps, última "5+").
 *   Aquecimento sempre incluído.
 * - Acessórios só existem para semanas 1-3 (semana 4 = deload).
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";

export type Levantamento531 =
  | "Agachamento"
  | "Terra"
  | "Supino"
  | "Remada Curvada"
  | "Press";

export const LEVANTAMENTOS_BASE: Levantamento531[] = [
  "Agachamento",
  "Terra",
  "Supino",
  "Remada Curvada",
];

/**
 * Exercício do Banco vinculado FIXAMENTE a cada levantamento principal.
 * Herdamos nome de exibição e vídeo — sem seletor no editor.
 * IDs conferidos em `exercicios_personalizados`.
 */
export const LEVANTAMENTO_EXERCICIO_BASE: Record<
  Levantamento531,
  { categoria: string; exercicio_id: string; nome: string; video_url: string | null }
> = {
  Agachamento: {
    categoria: "DJS",
    exercicio_id: "0c0bdc0c-0df0-4999-bbe7-0c85471d4b34",
    nome: "Agachamento com Barra nas Costas",
    video_url: "https://youtube.com/shorts/LGnX-Tit8NY",
  },
  Terra: {
    categoria: "DQ",
    exercicio_id: "64cf35a1-03b0-4b89-b46f-3a893dbf65cc",
    nome: "Levantamento Terra com Barra Reta",
    video_url:
      "https://www.youtube.com/watch?v=H6QBUUGcOo8&list=PLiJxKiFjIcoGNnq88E0EIVBJp22EZ1eTn&index=1",
  },
  Supino: {
    categoria: "EH",
    exercicio_id: "2f8139b2-d0cc-4f34-8b2c-396b5e0a039f",
    nome: "Supino",
    video_url: "https://www.youtube.com/watch?v=Eas2ERzSBTs",
  },
  "Remada Curvada": {
    categoria: "PH",
    exercicio_id: "a12123f6-cd05-4cc9-a3d1-b77fa0d180d0",
    nome: "Remada Curvada com Barra",
    video_url: "https://www.youtube.com/watch?v=Jz4SXmEn_iw",
  },
  Press: {
    categoria: "EV",
    exercicio_id: "304266f3-1a23-435b-9d21-703d00b0db8b",
    nome: "Press com Barra (SM)",
    video_url: "https://youtube.com/shorts/G9O1KSUUY7Q",
  },
};

export interface DiaLevantamento531 {
  levantamento: Levantamento531;
  rm_1: number; // 1RM em kg, digitado pelo professor
}

export interface AcessorioSemana531 {
  semana: 1 | 2 | 3;
  series: number;
  reps: string; // texto livre (ex: "10", "8-10", "AMRAP")
  percentual: number; // % sobre TM do levantamento vinculado
}

export interface Acessorio531 {
  vinculado_a: Levantamento531; // um dos levantamentos principais do MESMO dia
  /** Padrão de movimento (código curto tipo "DJS" ou subcategoria custom). */
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  semanas: AcessorioSemana531[]; // 3 entradas (semanas 1..3)
}

export interface Auxiliar531 {
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series: number;
  reps: string;
  kg?: string; // livre / opcional — não calculado
}


export interface Dia531 {
  ordem: number; // 1..N
  levantamentos: DiaLevantamento531[];
  acessorios: Acessorio531[];
  auxiliares: Auxiliar531[];
}

export interface Wendler531Conteudo {
  variante: "531";
  frequencia: 2 | 3 | 4 | 5;
  percentual_training_max: number; // ex.: 90
  dias: Dia531[];
}

export function isWendler531(c: unknown): c is Wendler531Conteudo {
  return (
    typeof c === "object" &&
    c !== null &&
    (c as { variante?: unknown }).variante === "531"
  );
}

/** Arredonda para o múltiplo de 2,5kg mais próximo (não para cima). */
export function roundToNearest2_5(kg: number): number {
  if (!isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / 2.5) * 2.5;
}

export function trainingMax(rm1: number, pctTM: number): number {
  if (!rm1 || !pctTM) return 0;
  return (rm1 * pctTM) / 100;
}

export interface SerieCalculada {
  pct: number;
  reps: string; // rótulo (ex: "5", "5+")
  kg: number;
  tipo: "aquecimento" | "trabalho";
}

export interface SemanaCalculada {
  semana: 1 | 2 | 3 | 4;
  series: SerieCalculada[];
}

const AQUECIMENTO: Array<{ pct: number; reps: string }> = [
  { pct: 40, reps: "5" },
  { pct: 50, reps: "5" },
  { pct: 60, reps: "5" },
];

const TRABALHO: Record<1 | 2 | 3, Array<{ pct: number; reps: string }>> = {
  1: [
    { pct: 65, reps: "5" },
    { pct: 75, reps: "5" },
    { pct: 85, reps: "5+" },
  ],
  2: [
    { pct: 70, reps: "5" },
    { pct: 80, reps: "3" },
    { pct: 90, reps: "3+" },
  ],
  3: [
    { pct: 75, reps: "5" },
    { pct: 85, reps: "3" },
    { pct: 95, reps: "1+" },
  ],
};

const DELOAD: Array<{ pct: number; reps: string }> = [
  { pct: 40, reps: "5" },
  { pct: 50, reps: "5" },
  { pct: 60, reps: "5" },
  { pct: 60, reps: "5" },
  { pct: 60, reps: "5" },
  { pct: 60, reps: "5+" },
];

/** Retorna as 4 semanas calculadas para um levantamento, com aquecimento sempre incluído. */
export function computeWave(rm1: number, pctTM: number): SemanaCalculada[] {
  const tm = trainingMax(rm1, pctTM);
  const mk = (
    src: Array<{ pct: number; reps: string }>,
    tipo: SerieCalculada["tipo"],
  ): SerieCalculada[] =>
    src.map((s) => ({
      pct: s.pct,
      reps: s.reps,
      kg: roundToNearest2_5((tm * s.pct) / 100),
      tipo,
    }));

  return [
    {
      semana: 1,
      series: [...mk(AQUECIMENTO, "aquecimento"), ...mk(TRABALHO[1], "trabalho")],
    },
    {
      semana: 2,
      series: [...mk(AQUECIMENTO, "aquecimento"), ...mk(TRABALHO[2], "trabalho")],
    },
    {
      semana: 3,
      series: [...mk(AQUECIMENTO, "aquecimento"), ...mk(TRABALHO[3], "trabalho")],
    },
    { semana: 4, series: mk(DELOAD, "trabalho") },
  ];
}

/** Calcula o kg de uma linha de acessório usando o TM do levantamento vinculado. */
export function acessorioKg(rm1Vinculado: number, pctTM: number, pctAcessorio: number): number {
  return roundToNearest2_5(
    (trainingMax(rm1Vinculado, pctTM) * pctAcessorio) / 100,
  );
}

export function emptyWendler531(frequencia: 2 | 3 | 4 | 5 = 4, pctTM = 90): Wendler531Conteudo {
  return {
    variante: "531",
    frequencia,
    percentual_training_max: pctTM,
    dias: Array.from({ length: frequencia }, (_, i) => ({
      ordem: i + 1,
      levantamentos: [],
      acessorios: [],
      auxiliares: [],
    })),
  };
}

/** Retorna a lista de levantamentos permitidos para uma dada frequência (Press só em 5x). */
export function levantamentosDisponiveis(frequencia: 2 | 3 | 4 | 5): Levantamento531[] {
  return frequencia === 5 ? [...LEVANTAMENTOS_BASE, "Press"] : LEVANTAMENTOS_BASE;
}
