/**
 * Easy Strength — tabela FIXA de %1RM por semana (não adaptativa).
 *
 * - 2 a 3 levantamentos, escolhidos livremente (mesmo pool/vínculos do PTTP).
 * - 2 ou 3 sessões por semana. TODOS os levantamentos são treinados em TODA
 *   sessão, sempre no MESMO nível de intensidade daquela sessão.
 * - 3 sessões/semana: T1 = Leve, T2 = Pesado, T3 = Médio (fixo).
 * - 2 sessões/semana: o professor escolhe quais 2 dos 3 níveis usar.
 * - Ciclo de 3 semanas repetido 3x (9 semanas). Depois da 9ª sessão de um
 *   slot, o ciclo REINICIA na semana 1 (é cíclico, não há "concluído").
 * - KG = 1RM × %, arredondado ao múltiplo de 2,5 kg.
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { roundToNearest2_5 } from "@/lib/m102";
import { type PTTPLevantamento, PTTP_LEVANTAMENTOS, PTTP_LEV_BASE } from "@/lib/pttp";

export const EASY_STRENGTH_LABEL = "Easy Strength";

/** Mesma lista/vínculos fixos do PTTP 1.0/2.0. */
export type ESLevantamento = PTTPLevantamento;
export const ES_LEVANTAMENTOS = PTTP_LEVANTAMENTOS;
export const ES_LEV_BASE = PTTP_LEV_BASE;

// ── Níveis ──────────────────────────────────────────────────────
export type ESNivel = "leve" | "pesado" | "medio";

export const ES_NIVEIS: ESNivel[] = ["leve", "pesado", "medio"];

export const ES_NIVEL_LABEL: Record<ESNivel, string> = {
  leve: "Leve",
  pesado: "Pesado",
  medio: "Médio",
};

// ── Tabela fixa de 9 semanas (ciclo de 3 semanas × 3) ───────────
export interface ESPlanoSemana {
  esquema: string;
  pct: number;
}

/** Ciclo base de 3 semanas por nível. Semana N usa o índice (N-1) % 3. */
export const ES_CICLO: Record<ESNivel, [ESPlanoSemana, ESPlanoSemana, ESPlanoSemana]> = {
  leve: [
    { esquema: "2x5", pct: 70 },
    { esquema: "2x5", pct: 75 },
    { esquema: "2x5", pct: 65 },
  ],
  pesado: [
    { esquema: "5x2", pct: 85 },
    { esquema: "6x1", pct: 90 },
    { esquema: "5x2", pct: 80 },
  ],
  medio: [
    { esquema: "3x3", pct: 80 },
    { esquema: "5,3,2", pct: 85 },
    { esquema: "3x3", pct: 75 },
  ],
};

export const ES_TOTAL_SEMANAS = 9;

/** Plano fixo da semana (1..9) daquele nível. */
export function planoES(nivel: ESNivel, semana: number): ESPlanoSemana {
  const n = ((Math.max(1, Math.round(semana)) - 1) % 3 + 3) % 3;
  return ES_CICLO[nivel][n];
}

/** Tabela completa das 9 semanas de um nível (para PDF/consulta). */
export function tabelaES(nivel: ESNivel): Array<ESPlanoSemana & { semana: number }> {
  return Array.from({ length: ES_TOTAL_SEMANAS }, (_, i) => ({
    semana: i + 1,
    ...planoES(nivel, i + 1),
  }));
}

/** Semana atual (1..9, cíclica) a partir das sessões concluídas daquele slot. */
export function semanaAtualES(sessoesConcluidas: number): number {
  const done = Math.max(0, Math.floor(sessoesConcluidas));
  return (done % ES_TOTAL_SEMANAS) + 1;
}

/** Quantas voltas completas de 9 semanas já foram feitas naquele slot. */
export function cicloAtualES(sessoesConcluidas: number): number {
  return Math.floor(Math.max(0, Math.floor(sessoesConcluidas)) / ES_TOTAL_SEMANAS) + 1;
}

/** KG = 1RM × %, arredondado ao múltiplo de 2,5 kg. */
export function kgES(rm1: number, pct: number): number {
  if (!rm1 || !pct) return 0;
  return roundToNearest2_5((rm1 * pct) / 100);
}

// ── Estrutura da prescrição ─────────────────────────────────────
export type ESAuxiliar = AuxiliarItem;

export const ES_AUXILIARES_POR_SESSAO = 2;
export const ES_MIN_LEVANTAMENTOS = 2;
export const ES_MAX_LEVANTAMENTOS = 3;
export type ESFrequencia = 2 | 3;
export const ES_FREQUENCIA_PADRAO: ESFrequencia = 3;

export interface ESLevantamentoConfig {
  levantamento: ESLevantamento;
  /** 1RM de referência, editável a qualquer momento pelo professor. */
  rm1: number;
}

export interface ESSessao {
  /** "T1" | "T2" | ... conforme a frequência. */
  slot: string;
  nivel: ESNivel;
  auxiliares: ESAuxiliar[];
}

export interface EasyStrengthConteudo {
  variante: "EASYSTRENGTH";
  frequencia: ESFrequencia;
  levantamentos: ESLevantamentoConfig[];
  sessoes: ESSessao[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  observacoes: string;
}

export function isEasyStrengthContent(raw: unknown): raw is EasyStrengthConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "EASYSTRENGTH"
  );
}

export function esSlots(frequencia: number | undefined): string[] {
  const total = frequencia === 2 ? 2 : 3;
  return Array.from({ length: total }, (_, i) => `T${i + 1}`);
}

export function auxiliarVazioES(): ESAuxiliar {
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

/** Níveis padrão: 3x = Leve, Pesado, Médio (fixo); 2x = Leve + Pesado. */
export function niveisPadraoES(frequencia: ESFrequencia): ESNivel[] {
  return frequencia === 3 ? ["leve", "pesado", "medio"] : ["leve", "pesado"];
}

/** Garante uma sessão por slot, com nível válido e 2 auxiliares. */
export function normalizarSessoesES(
  sessoes: ESSessao[] | undefined,
  frequencia: ESFrequencia,
): ESSessao[] {
  const slots = esSlots(frequencia);
  const padrao = niveisPadraoES(frequencia);
  return slots.map((slot, i) => {
    const atual = sessoes?.find((s) => s.slot === slot);
    // Em 3x/semana a ordem dos níveis é fixa; em 2x o professor escolhe.
    const nivel: ESNivel =
      frequencia === 3
        ? padrao[i]
        : atual && ES_NIVEIS.includes(atual.nivel)
          ? atual.nivel
          : padrao[i];
    const auxiliares = Array.from(
      { length: Math.max(ES_AUXILIARES_POR_SESSAO, atual?.auxiliares?.length ?? 0) },
      (_, j) => atual?.auxiliares?.[j] ?? auxiliarVazioES(),
    );
    return { slot, nivel, auxiliares };
  });
}

export function normalizarLevantamentosES(
  levs: ESLevantamentoConfig[] | undefined,
): ESLevantamentoConfig[] {
  const base = (levs ?? []).slice(0, ES_MAX_LEVANTAMENTOS).map((l) => ({
    levantamento: l.levantamento,
    rm1: Number(l.rm1) || 0,
  }));
  while (base.length < ES_MIN_LEVANTAMENTOS) {
    const usados = new Set(base.map((l) => l.levantamento));
    const livre = ES_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? ES_LEVANTAMENTOS[0];
    base.push({ levantamento: livre, rm1: 0 });
  }
  return base;
}

export function emptyEasyStrength(
  frequencia: ESFrequencia = ES_FREQUENCIA_PADRAO,
): EasyStrengthConteudo {
  return {
    variante: "EASYSTRENGTH",
    frequencia,
    levantamentos: normalizarLevantamentosES(undefined),
    sessoes: normalizarSessoesES(undefined, frequencia),
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    observacoes: "",
  };
}

/** Ajusta a prescrição inteira a uma nova frequência (2 ou 3). */
export function ajustarFrequenciaES(
  data: EasyStrengthConteudo,
  frequencia: ESFrequencia,
): EasyStrengthConteudo {
  return {
    ...data,
    frequencia,
    sessoes: normalizarSessoesES(data.sessoes, frequencia),
  };
}

export function sessaoDoSlotES(
  data: EasyStrengthConteudo,
  slot: string,
): ESSessao | undefined {
  return data.sessoes?.find((s) => s.slot === slot);
}

export interface ESAlvoLevantamento {
  levantamento: ESLevantamento;
  esquema: string;
  pct: number;
  kg: number;
}

/** Alvos de todos os levantamentos na sessão daquele slot/semana. */
export function alvosDaSessaoES(
  data: EasyStrengthConteudo,
  nivel: ESNivel,
  semana: number,
): ESAlvoLevantamento[] {
  const plano = planoES(nivel, semana);
  return data.levantamentos.map((l) => ({
    levantamento: l.levantamento,
    esquema: plano.esquema,
    pct: plano.pct,
    kg: kgES(l.rm1, plano.pct),
  }));
}
