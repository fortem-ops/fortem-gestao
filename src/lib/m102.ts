/**
 * Método M102 — 11 semanas regulares + sessão de teste.
 *
 * Regras (validadas com o gestor):
 * - 4 levantamentos com 1RM próprio: Terra, Agachamento, Remada Curvada, Supino.
 * - Um único "% Inicial" por prescrição (65 ou 70).
 * - 6 tiers, cada um = pctInicial + 5 × índice → ex.: 65 → 65,70,75,80,85,90.
 * - Cada tier dura 2 semanas, exceto o último (1 semana) → 11 semanas regulares.
 * - Reps-base por % ABSOLUTA: ≤65→5 · ≤70→4 · ≤75→3 · ≤85→2 · >85→1.
 * - Séries por % ABSOLUTA: ≤75→5 · ≤80→4 · ≤85→3 · >85→2.
 * - 2ª semana do tier: mesma %, mesmas séries, reps-base + 2.
 * - Slot A (T1/T2) e Slot B (T3/T4): Slot B = Slot A + 1 rep (mesmo kg).
 * - Cargas arredondadas ao múltiplo de 2,5kg mais próximo.
 * - 12ª sessão (teste) = 4 reps a 65% + 2 reps a 80% + 1 rep a 95% do 1RM ATUAL.
 *   Disponível quando os dois slots do par (T1↔T3 ou T2↔T4) baterem 11 sessões cada.
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";

export type M102Levantamento = "Terra" | "Supino" | "Agachamento" | "Remada";
export type M102Slot = "T1" | "T2" | "T3" | "T4";

/** Levantamentos e sub-slot (A/B) de cada dia. Estrutura fixa. */
export const M102_SLOT_LEVANTAMENTOS: Record<
  M102Slot,
  Array<{ levantamento: M102Levantamento; slotAB: "A" | "B" }>
> = {
  T1: [
    { levantamento: "Terra", slotAB: "A" },
    { levantamento: "Supino", slotAB: "A" },
  ],
  T2: [
    { levantamento: "Agachamento", slotAB: "A" },
    { levantamento: "Remada", slotAB: "A" },
  ],
  T3: [
    { levantamento: "Terra", slotAB: "B" },
    { levantamento: "Supino", slotAB: "B" },
  ],
  T4: [
    { levantamento: "Agachamento", slotAB: "B" },
    { levantamento: "Remada", slotAB: "B" },
  ],
};

/** Pares de slots que compartilham teste (11 sessões cada = pronto p/ teste). */
export const M102_PARES: Array<[M102Slot, M102Slot]> = [
  ["T1", "T3"],
  ["T2", "T4"],
];

export function pairOf(slot: M102Slot): M102Slot {
  return slot === "T1" ? "T3" : slot === "T3" ? "T1" : slot === "T2" ? "T4" : "T2";
}

/** Exercício do Banco vinculado a cada levantamento base (mesmos IDs do 5-3-1). */
export const M102_LEV_BASE: Record<
  M102Levantamento,
  { categoria: string; exercicio_id: string; nome: string; video_url: string | null }
> = {
  Terra: {
    categoria: "DQ",
    exercicio_id: "64cf35a1-03b0-4b89-b46f-3a893dbf65cc",
    nome: "Levantamento Terra com Barra Reta",
    video_url: "https://www.youtube.com/watch?v=H6QBUUGcOo8",
  },
  Agachamento: {
    categoria: "DJS",
    exercicio_id: "0c0bdc0c-0df0-4999-bbe7-0c85471d4b34",
    nome: "Agachamento com Barra nas Costas",
    video_url: "https://youtube.com/shorts/LGnX-Tit8NY",
  },
  Remada: {
    categoria: "PH",
    exercicio_id: "a12123f6-cd05-4cc9-a3d1-b77fa0d180d0",
    nome: "Remada Curvada com Barra",
    video_url: "https://www.youtube.com/watch?v=Jz4SXmEn_iw",
  },
  Supino: {
    categoria: "EH",
    exercicio_id: "2f8139b2-d0cc-4f34-8b2c-396b5e0a039f",
    nome: "Supino",
    video_url: "https://www.youtube.com/watch?v=Eas2ERzSBTs",
  },
};

export interface M102Acessorio {
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series: number;
  reps: string;
  kg?: string;
}

export interface M102TreinoDia {
  ordem: 1 | 2 | 3 | 4;
  acessorios: M102Acessorio[]; // máx. 3
}

export interface M102Rm {
  terra: number;
  agachamento: number;
  remada: number;
  supino: number;
}

export interface M102Conteudo {
  variante: "M102";
  percentualInicial: 65 | 70;
  rm: M102Rm;
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: M102TreinoDia[]; // 4 fixos
}

export function isM102(c: unknown): c is M102Conteudo {
  return (
    typeof c === "object" &&
    c !== null &&
    (c as { variante?: unknown }).variante === "M102"
  );
}

export function emptyM102(pctInicial: 65 | 70 = 65): M102Conteudo {
  return {
    variante: "M102",
    percentualInicial: pctInicial,
    rm: { terra: 0, agachamento: 0, remada: 0, supino: 0 },
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    treinos: [1, 2, 3, 4].map((n) => ({
      ordem: n as 1 | 2 | 3 | 4,
      acessorios: [],
    })),
  };
}

export function roundToNearest2_5(kg: number): number {
  if (!isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / 2.5) * 2.5;
}

export function kgFor(rm: number, pct: number): number {
  if (!rm) return 0;
  return roundToNearest2_5((rm * pct) / 100);
}

export function repsBaseFor(pct: number): number {
  if (pct <= 65) return 5;
  if (pct <= 70) return 4;
  if (pct <= 75) return 3;
  if (pct <= 85) return 2;
  return 1;
}

export function seriesFor(pct: number): number {
  if (pct <= 75) return 5;
  if (pct <= 80) return 4;
  if (pct <= 85) return 3;
  return 2;
}

export function tiersFor(pctInicial: 65 | 70): number[] {
  return Array.from({ length: 6 }, (_, i) => pctInicial + 5 * i);
}

export const M102_TOTAL_REGULAR = 11;

export interface M102SessionPlan {
  index: number; // 0..10
  tier: number; // 1..6
  semanaNoTier: 1 | 2;
  pct: number;
  series: number;
  repsA: number;
  repsB: number;
}

/** Cronograma completo de 11 sessões (por slot) dado o % Inicial. */
export function schedule11(pctInicial: 65 | 70): M102SessionPlan[] {
  const tiers = tiersFor(pctInicial);
  const out: M102SessionPlan[] = [];
  let idx = 0;
  tiers.forEach((pct, ti) => {
    const isLast = ti === tiers.length - 1;
    const weeks = isLast ? 1 : 2;
    const base = repsBaseFor(pct);
    const series = seriesFor(pct);
    for (let w = 1; w <= weeks; w++) {
      const repsA = base + (w === 2 ? 2 : 0);
      out.push({
        index: idx++,
        tier: ti + 1,
        semanaNoTier: w as 1 | 2,
        pct,
        series,
        repsA,
        repsB: repsA + 1,
      });
    }
  });
  return out; // 11 entradas
}

export interface M102TestSerie {
  reps: number;
  pct: number;
  kg: number;
}

export function testSession(rm: number): M102TestSerie[] {
  return [
    { reps: 4, pct: 65, kg: kgFor(rm, 65) },
    { reps: 2, pct: 80, kg: kgFor(rm, 80) },
    { reps: 1, pct: 95, kg: kgFor(rm, 95) },
  ];
}

export function rmForLevantamento(rm: M102Rm, lev: M102Levantamento): number {
  switch (lev) {
    case "Terra":
      return rm.terra;
    case "Agachamento":
      return rm.agachamento;
    case "Remada":
      return rm.remada;
    case "Supino":
      return rm.supino;
  }
}

export type M102SlotStatus =
  | { phase: "regular"; next: M102SessionPlan; done: number }
  | { phase: "readyForTest"; done: number }
  | { phase: "waitingPair"; done: number; pairDone: number }
  | { phase: "concluded"; done: number };

/**
 * Retorna o estado atual de um slot considerando sessões concluídas do próprio
 * slot e do slot par. Regra de conclusão: após a 12ª sessão (teste), o par
 * inteiro é considerado concluído — mensagem "Programa concluído".
 */
export function slotStatus(
  pctInicial: 65 | 70,
  doneThisSlot: number,
  donePairSlot: number,
): M102SlotStatus {
  if (doneThisSlot >= 12) return { phase: "concluded", done: doneThisSlot };
  if (doneThisSlot >= M102_TOTAL_REGULAR) {
    if (donePairSlot >= M102_TOTAL_REGULAR) {
      return { phase: "readyForTest", done: doneThisSlot };
    }
    return { phase: "waitingPair", done: doneThisSlot, pairDone: donePairSlot };
  }
  const sched = schedule11(pctInicial);
  return { phase: "regular", next: sched[doneThisSlot], done: doneThisSlot };
}
