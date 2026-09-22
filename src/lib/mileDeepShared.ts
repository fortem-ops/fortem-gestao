/**
 * Base comum dos métodos "Quality a Mile Deep" (versão 1RM e versão 5RM).
 *
 * - 3 blocos fixos de 4 semanas cada. Em cada bloco as repetições por série
 *   são fixas e o número de SÉRIES sobe 1 por semana:
 *     · Bloco 5 reps → 5, 6, 7, 8 séries   (NL 130)
 *     · Bloco 3 reps → 10, 11, 12, 13      (NL 138)
 *     · Bloco 2 reps → 12, 13, 14, 15      (NL 108)
 * - Ciclo de 12 semanas (um bloco por mês), na ORDEM escolhida livremente
 *   pelo professor. Depois da semana 12 o ciclo reinicia na semana 1
 *   (mesmo padrão cíclico do Easy Strength).
 * - Não há cálculo de KG: o sistema só informa a faixa de % válida do bloco;
 *   o peso é autorregulado (1-2 reps de reserva) e anotado manualmente.
 */

import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { type PTTPLevantamento, PTTP_LEVANTAMENTOS, PTTP_LEV_BASE } from "@/lib/pttp";

/** Mesmo pool/vínculos fixos do PTTP. */
export type MDLevantamento = PTTPLevantamento;
export const MD_LEVANTAMENTOS = PTTP_LEVANTAMENTOS;
export const MD_LEV_BASE = PTTP_LEV_BASE;

/** Levantamentos de membros inferiores (o resto é considerado superior). */
export const MD_LEVANTAMENTOS_INFERIORES: MDLevantamento[] = ["Agachamento", "Terra"];
export const MD_LEVANTAMENTOS_SUPERIORES: MDLevantamento[] = MD_LEVANTAMENTOS.filter(
  (l) => !MD_LEVANTAMENTOS_INFERIORES.includes(l),
);

export function ehInferiorMD(lev: MDLevantamento): boolean {
  return MD_LEVANTAMENTOS_INFERIORES.includes(lev);
}

// ── Blocos ──────────────────────────────────────────────────────
export type MDBlocoId = "b5" | "b3" | "b2";

export interface MDBloco {
  id: MDBlocoId;
  reps: number;
  /** Séries em cada uma das 4 semanas do bloco. */
  series: [number, number, number, number];
  /** Número de levantamentos (NL) total do bloco. */
  nl: number;
  label: string;
}

export const MD_BLOCOS: Record<MDBlocoId, MDBloco> = {
  b5: { id: "b5", reps: 5, series: [5, 6, 7, 8], nl: 130, label: "Bloco 5 reps" },
  b3: { id: "b3", reps: 3, series: [10, 11, 12, 13], nl: 138, label: "Bloco 3 reps" },
  b2: { id: "b2", reps: 2, series: [12, 13, 14, 15], nl: 108, label: "Bloco 2 reps" },
};

export const MD_BLOCO_IDS: MDBlocoId[] = ["b5", "b3", "b2"];
export const MD_SEMANAS_POR_BLOCO = 4;
export const MD_TOTAL_SEMANAS = MD_BLOCO_IDS.length * MD_SEMANAS_POR_BLOCO; // 12

/** Faixa de % válida por bloco (varia entre as duas variantes). */
export interface MDFaixa {
  min: number;
  max: number;
}
export type MDFaixas = Record<MDBlocoId, MDFaixa>;

export function faixaLabelMD(faixa: MDFaixa): string {
  return `${faixa.min}-${faixa.max}%`;
}

/** Ordem válida dos 3 blocos (sem repetição, sempre os 3). */
export function normalizarOrdemMD(ordem: MDBlocoId[] | undefined): MDBlocoId[] {
  const out: MDBlocoId[] = [];
  (ordem ?? []).forEach((b) => {
    if (MD_BLOCO_IDS.includes(b) && !out.includes(b)) out.push(b);
  });
  MD_BLOCO_IDS.forEach((b) => {
    if (!out.includes(b)) out.push(b);
  });
  return out;
}

/** Semana atual (1..12, cíclica) a partir das sessões concluídas. */
export function semanaAtualMD(sessoesConcluidas: number): number {
  const done = Math.max(0, Math.floor(sessoesConcluidas));
  return (done % MD_TOTAL_SEMANAS) + 1;
}

/** Quantas voltas completas de 12 semanas já foram feitas. */
export function cicloAtualMD(sessoesConcluidas: number): number {
  return Math.floor(Math.max(0, Math.floor(sessoesConcluidas)) / MD_TOTAL_SEMANAS) + 1;
}

export interface MDPlanoSemana {
  semana: number;
  /** 1..3 — posição do bloco na ordem escolhida. */
  mes: number;
  bloco: MDBloco;
  /** 1..4 — semana dentro do bloco. */
  semanaNoBloco: number;
  series: number;
  reps: number;
  /** Ex.: "7x5". */
  esquema: string;
  faixa: MDFaixa;
  faixaLabel: string;
}

/** Plano da semana (1..12) conforme a ordem de blocos e as faixas da variante. */
export function planoMD(
  ordem: MDBlocoId[],
  semana: number,
  faixas: MDFaixas,
): MDPlanoSemana {
  const ord = normalizarOrdemMD(ordem);
  const s = (((Math.max(1, Math.round(semana)) - 1) % MD_TOTAL_SEMANAS) + MD_TOTAL_SEMANAS) %
    MD_TOTAL_SEMANAS;
  const mesIdx = Math.floor(s / MD_SEMANAS_POR_BLOCO);
  const semanaNoBloco = (s % MD_SEMANAS_POR_BLOCO) + 1;
  const bloco = MD_BLOCOS[ord[mesIdx]];
  const series = bloco.series[semanaNoBloco - 1];
  const faixa = faixas[bloco.id];
  return {
    semana: s + 1,
    mes: mesIdx + 1,
    bloco,
    semanaNoBloco,
    series,
    reps: bloco.reps,
    esquema: `${series}x${bloco.reps}`,
    faixa,
    faixaLabel: faixaLabelMD(faixa),
  };
}

/** Tabela completa das 12 semanas (para editor, portal e PDF). */
export function tabelaMD(ordem: MDBlocoId[], faixas: MDFaixas): MDPlanoSemana[] {
  return Array.from({ length: MD_TOTAL_SEMANAS }, (_, i) => planoMD(ordem, i + 1, faixas));
}

// ── Auxiliares ──────────────────────────────────────────────────
export type MDAuxiliar = AuxiliarItem;

export function auxiliarVazioMD(): MDAuxiliar {
  return {
    categoria: "",
    exercicio: "",
    exercicio_id: null,
    video_url: null,
    series: 3,
    reps: "8",
    kg: "",
  };
}

/** Slots T1..Tn. */
export function slotsMD(total: number): string[] {
  const n = Math.max(1, Math.floor(total));
  return Array.from({ length: n }, (_, i) => `T${i + 1}`);
}

export const MD_AQUECIMENTO_VAZIO = { LIB: [], MOB: [], ATI: [], PREV: [] };
