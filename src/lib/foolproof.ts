/**
 * Foolproof — progressão linear "à prova de falhas", em cima de um 1RM de
 * referência (normalmente o 1RM testado ao fim do Power to the People 2.0).
 *
 * Diferenças-chave em relação ao PTTP 2.0:
 * - Peso inicial = 70% do 1RM de referência.
 * - Incremento FIXO = 2,5% do 1RM de referência ORIGINAL (não composto),
 *   arredondado a 2,5 kg e nunca menor que 2,5 kg. Calculado uma única vez.
 * - Frequência totalmente flexível: slots compartilhados T1..Tn (como no
 *   Plan Strong 50). Cada levantamento marca 1 slot como sessão PRINCIPAL e,
 *   opcionalmente, 1 slot de HIPERTROFIA (sem progressão).
 * - 3 fases (5x5 → 3x3 → 2x2), troca sempre manual. Não há fase de teste:
 *   o professor encerra o ciclo manualmente (1RM final é opcional).
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { roundToNearest2_5 } from "@/lib/m102";
import {
  type PTTPLevantamento,
  PTTP_LEVANTAMENTOS,
  PTTP_LEV_BASE,
  lombardi,
} from "@/lib/pttp";

export const FOOLPROOF_LABEL = "Foolproof";

/** Mesma lista/vínculos do PTTP 1.0/2.0. */
export type FPLevantamento = PTTPLevantamento;
export const FP_LEVANTAMENTOS = PTTP_LEVANTAMENTOS;
export const FP_LEV_BASE = PTTP_LEV_BASE;

// ── Fases ───────────────────────────────────────────────────────
export type FPFase = "5x5" | "3x3" | "2x2";

export const FP_FASES: FPFase[] = ["5x5", "3x3", "2x2"];

export const FP_FASE_LABEL: Record<FPFase, string> = {
  "5x5": "5 séries de 5",
  "3x3": "3 séries de 3",
  "2x2": "2 séries de 2",
};

export const FP_FASE_ESQUEMA: Record<FPFase, string> = {
  "5x5": "5x5",
  "3x3": "3x3",
  "2x2": "2x2",
};

export function proximaFaseFP(fase: FPFase): FPFase | null {
  const i = FP_FASES.indexOf(fase);
  return i >= 0 && i < FP_FASES.length - 1 ? FP_FASES[i + 1] : null;
}

// ── Constantes ──────────────────────────────────────────────────
/** Peso inicial = 70% do 1RM de referência. */
export const FP_PCT_INICIAL = 0.7;
/** Incremento semanal = 2,5% do 1RM de referência original. */
export const FP_INCREMENTO_PCT = 0.025;
export const FP_INCREMENTO_MINIMO = 2.5;

export const FP_MIN_LEVANTAMENTOS = 2;
export const FP_MAX_LEVANTAMENTOS = 4;

export const FP_DIAS_MIN = 2;
export const FP_DIAS_MAX = 6;
export const FP_DIAS_PADRAO = 3;

export const FP_AUXILIARES_POR_SLOT = 3;

/** Hipertrofia: 3 a 5 séries, sempre 5 reps. */
export const FP_HIPER_REPS = 5;
export const FP_HIPER_SERIES_MIN = 3;
export const FP_HIPER_SERIES_MAX = 5;
export const FP_HIPER_PCT_PADRAO = 0.6;

// ── Origem do 1RM ───────────────────────────────────────────────
export type FPOrigem =
  /** 1RM testado ao final do PTTP 2.0, informado direto. */
  | { tipo: "herdado"; rm1: number }
  /** 1RM estimado por Lombardi a partir de um teste carga × reps. */
  | { tipo: "lombardi"; carga: number; reps: number; rm1: number }
  /** 1RM informado direto. */
  | { tipo: "novo"; rm1: number };

/** 1RM estimado por Lombardi (mesma equação já usada no 1.0/2.0). */
export function rm1PorLombardi(carga: number, reps: number): number {
  return lombardi(carga, reps).e1rm;
}

/** Peso inicial = 70% do 1RM, arredondado a 2,5 kg. */
export function pesoInicialFP(rm1: number): number {
  if (!rm1) return 0;
  return roundToNearest2_5(rm1 * FP_PCT_INICIAL);
}

/**
 * Incremento fixo = 2,5% do 1RM de referência, arredondado a 2,5 kg,
 * nunca menor que 2,5 kg. Calculado uma vez e reutilizado toda semana.
 */
export function incrementoFP(rm1: number): number {
  if (!rm1) return FP_INCREMENTO_MINIMO;
  return Math.max(FP_INCREMENTO_MINIMO, roundToNearest2_5(rm1 * FP_INCREMENTO_PCT));
}

/** Peso da sessão de hipertrofia = %1RM do 1RM de referência. */
export function pesoHipertrofiaFP(rm1: number, pct: number): number {
  if (!rm1 || !pct) return 0;
  return roundToNearest2_5(rm1 * pct);
}

// ── Estado ──────────────────────────────────────────────────────
export interface FPSessaoHistorico {
  /** yyyy-MM-dd */
  data: string;
  /** Nº da semana/sessão principal (1-based). */
  semana: number;
  peso: number;
  fase: FPFase;
}

export interface FPHipertrofia {
  ativa: boolean;
  /** Slot (T1..Tn) da sessão de hipertrofia. */
  slot: string;
  /** 3 a 5 séries; reps sempre 5. */
  series: number;
  /** Fração do 1RM de referência (ex.: 0,6). */
  pct: number;
}

export interface FPEstadoLevantamento {
  levantamento: FPLevantamento;
  origem: FPOrigem;
  /** Incremento fixo congelado quando o 1RM de referência foi definido. */
  incremento: number;
  pesoAtual: number;
  fase: FPFase;
  /** Slot (T1..Tn) da sessão principal — obrigatório. */
  slotPrincipal: string;
  hipertrofia: FPHipertrofia;
  historico: FPSessaoHistorico[];
  /** Ciclo encerrado manualmente pelo professor. */
  concluido?: boolean;
  /** 1RM final, opcional. */
  rm1Final?: number | null;
  concluidoEm?: string | null;
}

export type FPAuxiliar = AuxiliarItem;

export interface FoolproofConteudo {
  variante: "FOOLPROOF";
  /** Quantos slots T1..Tn existem na prescrição inteira. */
  diasTreinoSemana: number;
  levantamentos: FPEstadoLevantamento[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  /** Auxiliares por slot — chave "T1", "T2", ... */
  auxiliaresPorSlot: Record<string, FPAuxiliar[]>;
  observacoes: string;
}

export function isFoolproofContent(raw: unknown): raw is FoolproofConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "FOOLPROOF"
  );
}

// ── Slots ───────────────────────────────────────────────────────
export function fpSlots(n: number | undefined): string[] {
  const total = Math.min(FP_DIAS_MAX, Math.max(FP_DIAS_MIN, n ?? FP_DIAS_PADRAO));
  return Array.from({ length: total }, (_, i) => `T${i + 1}`);
}

export function fpAuxiliaresDoSlot(data: FoolproofConteudo, slot: string): FPAuxiliar[] {
  return data.auxiliaresPorSlot?.[slot] ?? [];
}

export interface FPSessaoDoSlot {
  estado: FPEstadoLevantamento;
  tipo: "principal" | "hipertrofia";
}

/** Levantamentos que treinam naquele slot, e em que regime. */
export function fpLevantamentosDoSlot(
  data: FoolproofConteudo,
  slot: string,
): FPSessaoDoSlot[] {
  const out: FPSessaoDoSlot[] = [];
  data.levantamentos.forEach((l) => {
    if (l.slotPrincipal === slot) out.push({ estado: l, tipo: "principal" });
    if (l.hipertrofia?.ativa && l.hipertrofia.slot === slot) {
      out.push({ estado: l, tipo: "hipertrofia" });
    }
  });
  return out;
}

/** O slot tem ao menos uma sessão principal (logo, dispara progressão). */
export function fpSlotTemPrincipal(data: FoolproofConteudo, slot: string): boolean {
  return data.levantamentos.some((l) => l.slotPrincipal === slot);
}

// ── Alvos ───────────────────────────────────────────────────────
export function cicloConcluidoFP(estado: FPEstadoLevantamento): boolean {
  return estado.concluido === true;
}

export function alvoFP(estado: FPEstadoLevantamento): {
  esquema: string;
  peso: number;
  concluido: boolean;
} {
  return {
    esquema: FP_FASE_ESQUEMA[estado.fase],
    peso: estado.pesoAtual,
    concluido: cicloConcluidoFP(estado),
  };
}

/** Alvo fixo da sessão de hipertrofia (não progride). */
export function alvoHipertrofiaFP(estado: FPEstadoLevantamento): {
  esquema: string;
  peso: number;
} | null {
  const h = estado.hipertrofia;
  if (!h?.ativa) return null;
  return {
    esquema: `${h.series}x${FP_HIPER_REPS}`,
    peso: pesoHipertrofiaFP(estado.origem.rm1 ?? 0, h.pct),
  };
}

// ── Progressão ──────────────────────────────────────────────────
/**
 * Sessão PRINCIPAL concluída: grava o histórico e soma o incremento fixo.
 * A sessão de hipertrofia nunca chama esta função.
 */
export function registrarSessaoPrincipalFP(
  estado: FPEstadoLevantamento,
  data: string,
): FPEstadoLevantamento {
  if (cicloConcluidoFP(estado)) return estado;
  const incremento = estado.incremento || incrementoFP(estado.origem.rm1 ?? 0);
  return {
    ...estado,
    historico: [
      ...estado.historico,
      {
        data,
        semana: estado.historico.length + 1,
        peso: estado.pesoAtual,
        fase: estado.fase,
      },
    ],
    pesoAtual: roundToNearest2_5(estado.pesoAtual + incremento),
  };
}

/** Avança a fase manualmente; o peso continua de onde estava. */
export function avancarFaseFP(estado: FPEstadoLevantamento): FPEstadoLevantamento {
  if (cicloConcluidoFP(estado)) return estado;
  const prox = proximaFaseFP(estado.fase);
  return prox ? { ...estado, fase: prox } : estado;
}

export function definirFaseFP(
  estado: FPEstadoLevantamento,
  fase: FPFase,
): FPEstadoLevantamento {
  return { ...estado, fase };
}

/** Encerra o ciclo manualmente; o 1RM final é opcional. */
export function encerrarCicloFP(
  estado: FPEstadoLevantamento,
  data: string,
  rm1Final?: number | null,
): FPEstadoLevantamento {
  return {
    ...estado,
    concluido: true,
    concluidoEm: data,
    rm1Final: rm1Final && rm1Final > 0 ? rm1Final : null,
  };
}

/** Reabre o ciclo (encerramento por engano). */
export function reabrirCicloFP(estado: FPEstadoLevantamento): FPEstadoLevantamento {
  return { ...estado, concluido: false, concluidoEm: null, rm1Final: null };
}

/** Define o 1RM de referência: recalcula incremento e (se ainda não houve sessão) o peso inicial. */
export function definirRm1FP(
  estado: FPEstadoLevantamento,
  origem: FPOrigem,
): FPEstadoLevantamento {
  const rm1 = origem.rm1 ?? 0;
  return {
    ...estado,
    origem,
    incremento: incrementoFP(rm1),
    ...(estado.historico.length === 0 ? { pesoAtual: pesoInicialFP(rm1) } : {}),
  };
}

// ── Estruturas vazias / normalização ────────────────────────────
export function hipertrofiaVaziaFP(slot = "T2"): FPHipertrofia {
  return { ativa: false, slot, series: FP_HIPER_SERIES_MIN, pct: FP_HIPER_PCT_PADRAO };
}

export function estadoVazioFP(
  lev: FPLevantamento,
  slotPrincipal = "T1",
): FPEstadoLevantamento {
  return {
    levantamento: lev,
    origem: { tipo: "herdado", rm1: 0 },
    incremento: FP_INCREMENTO_MINIMO,
    pesoAtual: 0,
    fase: "5x5",
    slotPrincipal,
    hipertrofia: hipertrofiaVaziaFP(),
    historico: [],
    concluido: false,
    rm1Final: null,
    concluidoEm: null,
  };
}

export function auxiliarVazioFP(): FPAuxiliar {
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

/** Garante 2 a 4 levantamentos, todos com slots válidos. */
export function normalizarLevantamentosFP(
  levs: FPEstadoLevantamento[] | undefined,
  dias: number,
): FPEstadoLevantamento[] {
  const slots = fpSlots(dias);
  const base = (levs ?? []).slice(0, FP_MAX_LEVANTAMENTOS).map((l) => ({
    ...l,
    incremento: l.incremento || incrementoFP(l.origem?.rm1 ?? 0),
    slotPrincipal: slots.includes(l.slotPrincipal) ? l.slotPrincipal : slots[0],
    hipertrofia: {
      ...hipertrofiaVaziaFP(slots[1] ?? slots[0]),
      ...(l.hipertrofia ?? {}),
      slot:
        l.hipertrofia && slots.includes(l.hipertrofia.slot)
          ? l.hipertrofia.slot
          : (slots[1] ?? slots[0]),
    },
    historico: l.historico ?? [],
  }));
  while (base.length < FP_MIN_LEVANTAMENTOS) {
    const usados = new Set(base.map((l) => l.levantamento));
    const livre = FP_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? FP_LEVANTAMENTOS[0];
    base.push(estadoVazioFP(livre, slots[base.length % slots.length]));
  }
  return base;
}

/** Garante um array de 3 auxiliares para cada slot existente. */
export function normalizarAuxiliaresFP(
  atual: Record<string, FPAuxiliar[]> | undefined,
  dias: number,
): Record<string, FPAuxiliar[]> {
  const out: Record<string, FPAuxiliar[]> = {};
  fpSlots(dias).forEach((slot) => {
    const itens = atual?.[slot] ?? [];
    out[slot] =
      itens.length > 0
        ? itens
        : Array.from({ length: FP_AUXILIARES_POR_SLOT }, () => auxiliarVazioFP());
  });
  return out;
}

export function emptyFoolproof(dias = FP_DIAS_PADRAO): FoolproofConteudo {
  return {
    variante: "FOOLPROOF",
    diasTreinoSemana: dias,
    levantamentos: normalizarLevantamentosFP(undefined, dias),
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    auxiliaresPorSlot: normalizarAuxiliaresFP(undefined, dias),
    observacoes: "",
  };
}

/** Ajusta a prescrição inteira a um novo número de dias de treino. */
export function ajustarDiasFP(
  data: FoolproofConteudo,
  dias: number,
): FoolproofConteudo {
  const total = Math.min(FP_DIAS_MAX, Math.max(FP_DIAS_MIN, dias));
  return {
    ...data,
    diasTreinoSemana: total,
    levantamentos: normalizarLevantamentosFP(data.levantamentos, total),
    auxiliaresPorSlot: normalizarAuxiliaresFP(data.auxiliaresPorSlot, total),
  };
}
