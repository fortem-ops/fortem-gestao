/**
 * Quality a Mile Deep — 5RM (adaptação, base 5RM).
 *
 * - Até 4 levantamentos, cada um com SUA sessão dedicada (4 sessões/semana),
 *   com ordem de blocos INDEPENDENTE por levantamento (não pareados).
 * - Faixas de %5RM (mais amplas): 5 reps 60-95% · 3 reps 70-80% · 2 reps 75-95%.
 * - Sem cálculo de KG — só a faixa de % válida da semana.
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import {
  type MDAuxiliar,
  type MDBlocoId,
  type MDFaixas,
  type MDLevantamento,
  type MDPlanoSemana,
  MD_LEVANTAMENTOS,
  auxiliarVazioMD,
  normalizarOrdemMD,
  planoMD,
  slotsMD,
  tabelaMD,
} from "@/lib/mileDeepShared";

export const MILEDEEP5RM_LABEL = "Quality a Mile Deep — 5RM";

export const MD5_FAIXAS: MDFaixas = {
  b5: { min: 60, max: 95 },
  b3: { min: 70, max: 80 },
  b2: { min: 75, max: 95 },
};

export const MD5_MIN_SESSOES = 1;
export const MD5_MAX_SESSOES = 4;

export interface MD5Sessao {
  /** "T1".."T4". */
  slot: string;
  levantamento: MDLevantamento;
  /** 5RM de referência, editável a qualquer momento. */
  rm5: number;
  /** Ordem dos 3 blocos, independente por levantamento. */
  ordem: MDBlocoId[];
  auxiliares: MDAuxiliar[];
}

export interface MileDeep5RMConteudo {
  variante: "MILEDEEP5RM";
  sessoes: MD5Sessao[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  observacoes: string;
}

export function isMileDeep5RMContent(raw: unknown): raw is MileDeep5RMConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "MILEDEEP5RM"
  );
}

const ORDENS_PADRAO: MDBlocoId[][] = [
  ["b5", "b3", "b2"],
  ["b3", "b2", "b5"],
  ["b2", "b5", "b3"],
  ["b5", "b2", "b3"],
];

export function sessaoVaziaMD5(idx: number): MD5Sessao {
  return {
    slot: `T${idx + 1}`,
    levantamento: MD_LEVANTAMENTOS[idx % MD_LEVANTAMENTOS.length],
    rm5: 0,
    ordem: ORDENS_PADRAO[idx % ORDENS_PADRAO.length],
    auxiliares: [auxiliarVazioMD()],
  };
}

export function normalizarSessoesMD5(sessoes: MD5Sessao[] | undefined): MD5Sessao[] {
  const base = (sessoes ?? []).slice(0, MD5_MAX_SESSOES);
  const total = Math.max(MD5_MIN_SESSOES, base.length || MD5_MAX_SESSOES);
  return Array.from({ length: total }, (_, i) => {
    const atual = base[i];
    const vazio = sessaoVaziaMD5(i);
    if (!atual) return vazio;
    return {
      slot: `T${i + 1}`,
      levantamento: atual.levantamento ?? vazio.levantamento,
      rm5: Number(atual.rm5) || 0,
      ordem: normalizarOrdemMD(atual.ordem),
      auxiliares: atual.auxiliares ?? [],
    };
  });
}

export function emptyMileDeep5RM(): MileDeep5RMConteudo {
  return {
    variante: "MILEDEEP5RM",
    sessoes: normalizarSessoesMD5(undefined),
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    observacoes: "",
  };
}

export function md5Slots(data: MileDeep5RMConteudo): string[] {
  return slotsMD(data.sessoes?.length || MD5_MAX_SESSOES);
}

/** Plano da semana daquele levantamento/sessão. */
export function planoMD5(sessao: MD5Sessao, semana: number): MDPlanoSemana {
  return planoMD(sessao.ordem, semana, MD5_FAIXAS);
}

/** Tabela das 12 semanas daquele levantamento. */
export function tabelaMD5(sessao: MD5Sessao): MDPlanoSemana[] {
  return tabelaMD(sessao.ordem, MD5_FAIXAS);
}
