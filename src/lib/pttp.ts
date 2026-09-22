/**
 * Power to the People (PTTP) — progressão viva, dependente do resultado real.
 *
 * - Frequência configurável (3 a 5 treinos/semana).
 * - 2 levantamentos centrais escolhidos pelo professor, treinados em TODO
 *   treino, cada um com progressão independente.
 * - Cada treino tem 3 auxiliares (categoria + exercício livre, séries/reps
 *   fixos definidos pelo professor, kg manual).
 * - Não existe tabela fixa por sessão: o peso da próxima sessão depende do
 *   histórico (sucesso → sobe; falha → desconto e reinício da contagem).
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { roundToNearest2_5 } from "@/lib/m102";
import { LEVANTAMENTO_EXERCICIO_BASE } from "@/lib/wendler531";

export type PTTPLevantamento =
  | "Agachamento"
  | "Terra"
  | "Supino"
  | "Press"
  | "Remada Curvada";

export const PTTP_LEVANTAMENTOS: PTTPLevantamento[] = [
  "Agachamento",
  "Terra",
  "Supino",
  "Press",
  "Remada Curvada",
];

/** Vínculos fixos com o Banco de Exercícios (mesmos do 5-3-1 / X-FAB). */
export const PTTP_LEV_BASE = LEVANTAMENTO_EXERCICIO_BASE;

// ── Constantes da progressão ────────────────────────────────────
/** Incremento padrão por sessão bem-sucedida (2,5% dentro da faixa 2-3%). */
export const PTTP_INCREMENTO_PCT = 0.025;
/** Incremento mínimo em kg, mesmo quando a % der menos. */
export const PTTP_INCREMENTO_MINIMO = 2.5;
/** Desconto após falha com menos de PTTP_LIMIAR_SESSOES sessões desde o reset. */
export const PTTP_DESCONTO_RECENTE = 0.15;
/** Desconto após falha com ciclo mais longo (meio da faixa 10-15%). */
export const PTTP_DESCONTO_LONGO = 0.125;
export const PTTP_LIMIAR_SESSOES = 8;
/** Quantas sessões voltar no histórico ao usar "Pulei um treino". */
export const PTTP_DIAS_RECUO = 2;
/** Recuo alternativo quando não há PTTP_DIAS_RECUO sessões no histórico. */
export const PTTP_DIAS_RECUO_FALLBACK = 3;

export const PTTP_SERIES_RAMPA = "2x5";
export const PTTP_SERIES_MANUTENCAO = "3x3";

// ── Tipos ───────────────────────────────────────────────────────
export type PTTPModo = "rampa" | "manutencao";

export interface PTTPSessaoHistorico {
  /** yyyy-MM-dd */
  data: string;
  peso: number;
  sucesso: boolean;
}

export type PTTPOrigemPeso =
  | { metodo: "lombardi"; carga: number; reps: number }
  | { metodo: "rampa" };

export interface PTTPEstadoLevantamento {
  levantamento: PTTPLevantamento;
  origem: PTTPOrigemPeso;
  pesoAtual: number;
  sessoesDesdeReset: number;
  modo: PTTPModo;
  pesoManutencao?: number;
  historico: PTTPSessaoHistorico[];
}

export type PTTPAuxiliar = AuxiliarItem;

export interface PTTPTreino {
  ordem: number; // 1..frequencia
  auxiliares: PTTPAuxiliar[]; // 3 fixos
}

export type PTTPFrequencia = 3 | 4 | 5;

export interface PTTPConteudo {
  variante: "PTTP";
  frequencia: PTTPFrequencia;
  levantamentos: [PTTPEstadoLevantamento, PTTPEstadoLevantamento];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: PTTPTreino[];
  observacoes: string;
}

export const PTTP_AUXILIARES_POR_TREINO = 3;

export function isPTTPContent(raw: unknown): raw is PTTPConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "PTTP"
  );
}

// ── Peso inicial ────────────────────────────────────────────────
export interface LombardiResultado {
  y: number;
  x: number;
  e1rm: number;
  rm5: number;
  pesoInicial: number;
}

/** Equação de Lombardi → peso inicial (80% do 5RM, múltiplo de 2,5 kg). */
export function lombardi(carga: number, reps: number): LombardiResultado {
  const y = carga * reps;
  const x = y * 0.0333;
  const e1rm = carga + x;
  const rm5 = e1rm * 0.85;
  return { y, x, e1rm, rm5, pesoInicial: roundToNearest2_5(rm5 * 0.8) };
}

// ── Progressão ──────────────────────────────────────────────────
/** Próximo peso após uma sessão bem-sucedida. */
export function pesoAposSucesso(peso: number): number {
  const incremento = Math.max(peso * PTTP_INCREMENTO_PCT, PTTP_INCREMENTO_MINIMO);
  return roundToNearest2_5(peso + incremento);
}

/** Desconto aplicado após falha, conforme as sessões desde o último reset. */
export function descontoAposFalha(sessoesDesdeReset: number): number {
  return sessoesDesdeReset < PTTP_LIMIAR_SESSOES
    ? PTTP_DESCONTO_RECENTE
    : PTTP_DESCONTO_LONGO;
}

/** Próximo peso após falha. */
export function pesoAposFalha(peso: number, sessoesDesdeReset: number): number {
  return roundToNearest2_5(peso * (1 - descontoAposFalha(sessoesDesdeReset)));
}

/**
 * Registra o resultado de uma sessão de 2x5 e devolve o novo estado.
 * Levantamentos em manutenção não avançam (retorna o estado inalterado).
 */
export function registrarResultadoPTTP(
  estado: PTTPEstadoLevantamento,
  sucesso: boolean,
  data: string,
): PTTPEstadoLevantamento {
  if (estado.modo === "manutencao") return estado;
  const historico = [
    ...estado.historico,
    { data, peso: estado.pesoAtual, sucesso },
  ];
  if (sucesso) {
    return {
      ...estado,
      historico,
      sessoesDesdeReset: estado.sessoesDesdeReset + 1,
      pesoAtual: pesoAposSucesso(estado.pesoAtual),
    };
  }
  return {
    ...estado,
    historico,
    sessoesDesdeReset: 0,
    pesoAtual: pesoAposFalha(estado.pesoAtual, estado.sessoesDesdeReset),
  };
}

/**
 * "Pulei um treino": volta o peso para o de PTTP_DIAS_RECUO sessões atrás
 * (ou PTTP_DIAS_RECUO_FALLBACK quando não houver tantas). `sessoesDesdeReset`
 * não muda.
 */
export function recuarPorTreinoPulado(
  estado: PTTPEstadoLevantamento,
): PTTPEstadoLevantamento {
  const h = estado.historico;
  if (h.length === 0) return estado;
  const alvo =
    h.length >= PTTP_DIAS_RECUO
      ? h[h.length - PTTP_DIAS_RECUO]
      : h[Math.max(0, h.length - PTTP_DIAS_RECUO_FALLBACK)];
  if (!alvo) return estado;
  return { ...estado, pesoAtual: alvo.peso };
}

/** Marca o levantamento como estabilizado (3x3 no peso atual). */
export function entrarManutencao(
  estado: PTTPEstadoLevantamento,
): PTTPEstadoLevantamento {
  return { ...estado, modo: "manutencao", pesoManutencao: estado.pesoAtual };
}

/** Volta um levantamento de manutenção para a rampa. */
export function voltarParaRampa(
  estado: PTTPEstadoLevantamento,
): PTTPEstadoLevantamento {
  return { ...estado, modo: "rampa", pesoManutencao: undefined };
}

/** Texto do alvo da próxima sessão do levantamento. */
export function alvoPTTP(estado: PTTPEstadoLevantamento): {
  esquema: string;
  peso: number;
} {
  if (estado.modo === "manutencao") {
    return {
      esquema: PTTP_SERIES_MANUTENCAO,
      peso: estado.pesoManutencao ?? estado.pesoAtual,
    };
  }
  return { esquema: PTTP_SERIES_RAMPA, peso: estado.pesoAtual };
}

// ── Estruturas vazias / normalização ────────────────────────────
export function auxiliarVazioPTTP(): PTTPAuxiliar {
  return { categoria: "", exercicio: "", exercicio_id: null, video_url: null, series: 3, reps: "8", kg: "" };
}

export function estadoVazioPTTP(lev: PTTPLevantamento): PTTPEstadoLevantamento {
  return {
    levantamento: lev,
    origem: { metodo: "rampa" },
    pesoAtual: 0,
    sessoesDesdeReset: 0,
    modo: "rampa",
    historico: [],
  };
}

export function treinoVazioPTTP(ordem: number): PTTPTreino {
  return {
    ordem,
    auxiliares: Array.from({ length: PTTP_AUXILIARES_POR_TREINO }, auxiliarVazioPTTP),
  };
}

/** Garante `frequencia` treinos, cada um com 3 auxiliares. */
export function normalizarTreinosPTTP(
  treinos: PTTPTreino[] | undefined,
  frequencia: PTTPFrequencia,
): PTTPTreino[] {
  return Array.from({ length: frequencia }, (_, i) => {
    const ordem = i + 1;
    const atual = treinos?.find((t) => t.ordem === ordem);
    const auxiliares = Array.from(
      { length: PTTP_AUXILIARES_POR_TREINO },
      (_, j) => atual?.auxiliares?.[j] ?? auxiliarVazioPTTP(),
    );
    return { ordem, auxiliares };
  });
}

export function emptyPTTP(): PTTPConteudo {
  return {
    variante: "PTTP",
    frequencia: 3,
    levantamentos: [estadoVazioPTTP("Agachamento"), estadoVazioPTTP("Supino")],
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    treinos: normalizarTreinosPTTP(undefined, 3),
    observacoes: "",
  };
}

export const PTTP_LABEL = "Power to the People";
