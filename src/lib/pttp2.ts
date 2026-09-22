/**
 * Power to the People 2.0 — ciclo de continuidade da 1.0.
 *
 * Diferenças em relação à 1.0:
 * - 2 a 4 levantamentos, escolhidos livremente.
 * - Cada levantamento parte de um 5RM de referência (herdado do ciclo 1.0 ou
 *   estabelecido do zero por Lombardi / 5RM direto) × um percentual de 85-90%.
 * - Frequência fixa em 3 sessões por semana; todos os levantamentos em todas.
 * - Progressão automática e incondicional: cada sessão concluída sobe o peso
 *   (2,5%, mínimo 2,5 kg — mesma regra da 1.0). Não há sucesso/falha.
 * - 4 fases por levantamento, trocadas SEMPRE manualmente pelo professor/aluno.
 * - A fase "teste" encerra o ciclo do levantamento ao registrar o 1RM, que fica
 *   guardado como referência (usado depois pelo método Foolproof).
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { roundToNearest2_5 } from "@/lib/m102";
import {
  type PTTPLevantamento,
  type PTTPTreino,
  PTTP_LEVANTAMENTOS,
  PTTP_LEV_BASE,
  PTTP_AUXILIARES_POR_TREINO,
  pesoAposSucesso,
  lombardi,
  auxiliarVazioPTTP,
  normalizarTreinosPTTP,
} from "@/lib/pttp";

export const PTTP2_LABEL = "Power to the People 2.0";

/** Levantamentos e vínculos com o Banco de Exercícios: os mesmos da 1.0. */
export type PTTP2Levantamento = PTTPLevantamento;
export const PTTP2_LEVANTAMENTOS = PTTP_LEVANTAMENTOS;
export const PTTP2_LEV_BASE = PTTP_LEV_BASE;

// ── Fases ───────────────────────────────────────────────────────
export type PTTP2Fase = "5,3,2" | "3,2" | "2" | "teste";

export const PTTP2_FASES: PTTP2Fase[] = ["5,3,2", "3,2", "2", "teste"];

export const PTTP2_FASE_LABEL: Record<PTTP2Fase, string> = {
  "5,3,2": "Escada 5-3-2 (3 séries)",
  "3,2": "Escada 3-2 (2 séries)",
  "2": "Série única de 2",
  teste: "Teste de 1RM",
};

/** Esquema de séries mostrado ao aluno em cada fase. */
export const PTTP2_FASE_ESQUEMA: Record<PTTP2Fase, string> = {
  "5,3,2": "5, 3, 2",
  "3,2": "3, 2",
  "2": "2",
  teste: "Teste 1RM",
};

/** Próxima fase da sequência; `null` quando já está na última. */
export function proximaFasePTTP2(fase: PTTP2Fase): PTTP2Fase | null {
  const i = PTTP2_FASES.indexOf(fase);
  return i >= 0 && i < PTTP2_FASES.length - 1 ? PTTP2_FASES[i + 1] : null;
}

// ── Peso inicial ────────────────────────────────────────────────
export const PTTP2_PCT_MIN = 0.85;
export const PTTP2_PCT_MAX = 0.9;
export const PTTP2_PCT_PADRAO = 0.875;

export type PTTP2Origem =
  /** 5RM com que o levantamento terminou o ciclo 1.0, informado pelo professor. */
  | { tipo: "herdado"; rm5: number }
  /** 5RM novo estimado por Lombardi a partir de um teste carga × reps. */
  | { tipo: "lombardi"; carga: number; reps: number; rm5: number }
  /** 5RM novo informado direto. */
  | { tipo: "novo"; rm5: number };

/** Mantém o percentual dentro da faixa 85-90%. */
export function limitarPercentualPTTP2(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return PTTP2_PCT_PADRAO;
  return Math.min(PTTP2_PCT_MAX, Math.max(PTTP2_PCT_MIN, pct));
}

/** Peso inicial da 2.0 = 5RM de referência × percentual (85-90%). */
export function pesoInicialPTTP2(rm5: number, pct: number): number {
  if (!rm5) return 0;
  return roundToNearest2_5(rm5 * limitarPercentualPTTP2(pct));
}

/** 5RM estimado por Lombardi (mesmo cálculo da 1.0). */
export function rm5PorLombardi(carga: number, reps: number): number {
  return lombardi(carga, reps).rm5;
}

// ── Estado ──────────────────────────────────────────────────────
export interface PTTP2SessaoHistorico {
  /** yyyy-MM-dd */
  data: string;
  peso: number;
  fase: PTTP2Fase;
}

export interface PTTP2EstadoLevantamento {
  levantamento: PTTP2Levantamento;
  origem: PTTP2Origem;
  percentual: number;
  pesoAtual: number;
  fase: PTTP2Fase;
  historico: PTTP2SessaoHistorico[];
  /** 1RM registrado na fase de teste; fecha o ciclo do levantamento. */
  rm1Testado?: number | null;
  /** yyyy-MM-dd do teste. */
  rm1TestadoEm?: string | null;
}

export type PTTP2Auxiliar = PTTPTreino["auxiliares"][number];
export type PTTP2Treino = PTTPTreino;

export const PTTP2_FREQUENCIA = 3 as const;
export const PTTP2_MIN_LEVANTAMENTOS = 2;
export const PTTP2_MAX_LEVANTAMENTOS = 4;
export const PTTP2_AUXILIARES_POR_TREINO = PTTP_AUXILIARES_POR_TREINO;

export interface PTTP2Conteudo {
  variante: "PTTP2";
  frequencia: typeof PTTP2_FREQUENCIA;
  levantamentos: PTTP2EstadoLevantamento[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: PTTP2Treino[];
  observacoes: string;
}

export function isPTTP2Content(raw: unknown): raw is PTTP2Conteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "PTTP2"
  );
}

// ── Progressão ──────────────────────────────────────────────────
/** Levantamento encerrou o ciclo 2.0 (1RM já testado). */
export function cicloConcluidoPTTP2(estado: PTTP2EstadoLevantamento): boolean {
  return typeof estado.rm1Testado === "number" && estado.rm1Testado > 0;
}

/** Alvo da próxima sessão: esquema da fase + peso atual. */
export function alvoPTTP2(estado: PTTP2EstadoLevantamento): {
  esquema: string;
  peso: number;
  concluido: boolean;
} {
  return {
    esquema: PTTP2_FASE_ESQUEMA[estado.fase],
    peso: estado.pesoAtual,
    concluido: cicloConcluidoPTTP2(estado),
  };
}

/**
 * Registra uma sessão concluída: grava o histórico e sobe o peso sozinho.
 * Não faz nada na fase de teste nem depois do ciclo concluído.
 */
export function registrarSessaoPTTP2(
  estado: PTTP2EstadoLevantamento,
  data: string,
): PTTP2EstadoLevantamento {
  if (cicloConcluidoPTTP2(estado) || estado.fase === "teste") return estado;
  return {
    ...estado,
    historico: [
      ...estado.historico,
      { data, peso: estado.pesoAtual, fase: estado.fase },
    ],
    pesoAtual: pesoAposSucesso(estado.pesoAtual),
  };
}

/** Avança a fase manualmente; o peso continua de onde estava. */
export function avancarFasePTTP2(
  estado: PTTP2EstadoLevantamento,
): PTTP2EstadoLevantamento {
  if (cicloConcluidoPTTP2(estado)) return estado;
  const prox = proximaFasePTTP2(estado.fase);
  return prox ? { ...estado, fase: prox } : estado;
}

/** Define uma fase específica (professor pode voltar atrás). */
export function definirFasePTTP2(
  estado: PTTP2EstadoLevantamento,
  fase: PTTP2Fase,
): PTTP2EstadoLevantamento {
  return { ...estado, fase };
}

/** Registra o resultado do teste de 1RM e encerra o ciclo do levantamento. */
export function registrarTestePTTP2(
  estado: PTTP2EstadoLevantamento,
  rm1: number,
  data: string,
): PTTP2EstadoLevantamento {
  if (!rm1) return estado;
  return {
    ...estado,
    fase: "teste",
    rm1Testado: rm1,
    rm1TestadoEm: data,
    historico: [...estado.historico, { data, peso: rm1, fase: "teste" }],
  };
}

/** Desfaz o teste (erro de digitação) e devolve o levantamento ao ciclo. */
export function limparTestePTTP2(
  estado: PTTP2EstadoLevantamento,
): PTTP2EstadoLevantamento {
  return {
    ...estado,
    rm1Testado: null,
    rm1TestadoEm: null,
    historico: estado.historico.filter((h) => h.fase !== "teste"),
  };
}

/**
 * 1RMs testados na 2.0, por levantamento — referência para o método Foolproof.
 */
export function rm1TestadosPTTP2(
  conteudo: PTTP2Conteudo,
): Array<{ levantamento: PTTP2Levantamento; rm1: number; data: string | null }> {
  return conteudo.levantamentos
    .filter(cicloConcluidoPTTP2)
    .map((l) => ({
      levantamento: l.levantamento,
      rm1: l.rm1Testado as number,
      data: l.rm1TestadoEm ?? null,
    }));
}

// ── Estruturas vazias / normalização ────────────────────────────
export function estadoVazioPTTP2(lev: PTTP2Levantamento): PTTP2EstadoLevantamento {
  return {
    levantamento: lev,
    origem: { tipo: "novo", rm5: 0 },
    percentual: PTTP2_PCT_PADRAO,
    pesoAtual: 0,
    fase: "5,3,2",
    historico: [],
    rm1Testado: null,
    rm1TestadoEm: null,
  };
}

export function auxiliarVazioPTTP2(): PTTP2Auxiliar {
  return auxiliarVazioPTTP();
}

/** Garante 3 treinos com 3 auxiliares cada (frequência é fixa na 2.0). */
export function normalizarTreinosPTTP2(treinos: PTTP2Treino[] | undefined): PTTP2Treino[] {
  return normalizarTreinosPTTP(treinos, PTTP2_FREQUENCIA);
}

/** Mantém a lista de levantamentos entre 2 e 4. */
export function normalizarLevantamentosPTTP2(
  levs: PTTP2EstadoLevantamento[] | undefined,
): PTTP2EstadoLevantamento[] {
  const base = (levs ?? []).slice(0, PTTP2_MAX_LEVANTAMENTOS);
  while (base.length < PTTP2_MIN_LEVANTAMENTOS) {
    const usados = new Set(base.map((l) => l.levantamento));
    const livre = PTTP2_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? PTTP2_LEVANTAMENTOS[0];
    base.push(estadoVazioPTTP2(livre));
  }
  return base;
}

export function emptyPTTP2(): PTTP2Conteudo {
  return {
    variante: "PTTP2",
    frequencia: PTTP2_FREQUENCIA,
    levantamentos: [estadoVazioPTTP2("Agachamento"), estadoVazioPTTP2("Supino")],
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    treinos: normalizarTreinosPTTP2(undefined),
    observacoes: "",
  };
}
