/**
 * Quality a Mile Deep (original — base 1RM).
 *
 * - 4 levantamentos agrupados em 2 PARES fixos (1 superior + 1 inferior cada),
 *   formando 2 sessões por semana.
 * - Cada PAR compartilha UMA ordem de blocos: os dois levantamentos do par
 *   avançam juntos pelos mesmos 3 blocos, nos mesmos meses.
 * - Faixas de %1RM: 5 reps 60-80% · 3 reps 70-80% · 2 reps 75-90%.
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
  MD_LEVANTAMENTOS_INFERIORES,
  MD_LEVANTAMENTOS_SUPERIORES,
  auxiliarVazioMD,
  normalizarOrdemMD,
  planoMD,
  slotsMD,
  tabelaMD,
} from "@/lib/mileDeepShared";

export const MILEDEEP1RM_LABEL = "Quality a Mile Deep";

export const MD1_FAIXAS: MDFaixas = {
  b5: { min: 60, max: 80 },
  b3: { min: 70, max: 80 },
  b2: { min: 75, max: 90 },
};

export const MD1_TOTAL_PARES = 2;

export interface MD1LevConfig {
  levantamento: MDLevantamento;
  /** 1RM de referência, editável a qualquer momento. */
  rm1: number;
}

export interface MD1Par {
  /** "T1" | "T2". */
  slot: string;
  superior: MD1LevConfig;
  inferior: MD1LevConfig;
  /** Ordem dos 3 blocos ao longo dos 3 meses (livre). */
  ordem: MDBlocoId[];
  auxiliares: MDAuxiliar[];
}

export interface MileDeep1RMConteudo {
  variante: "MILEDEEP1RM";
  pares: MD1Par[];
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  observacoes: string;
}

export function isMileDeep1RMContent(raw: unknown): raw is MileDeep1RMConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "MILEDEEP1RM"
  );
}

export function md1Slots(): string[] {
  return slotsMD(MD1_TOTAL_PARES);
}

function levPadrao(lista: MDLevantamento[], idx: number): MDLevantamento {
  return lista[idx % lista.length];
}

export function parVazioMD1(idx: number): MD1Par {
  return {
    slot: `T${idx + 1}`,
    superior: { levantamento: levPadrao(MD_LEVANTAMENTOS_SUPERIORES, idx), rm1: 0 },
    inferior: { levantamento: levPadrao(MD_LEVANTAMENTOS_INFERIORES, idx), rm1: 0 },
    ordem: idx === 0 ? ["b5", "b3", "b2"] : ["b3", "b2", "b5"],
    auxiliares: [auxiliarVazioMD()],
  };
}

export function normalizarParesMD1(pares: MD1Par[] | undefined): MD1Par[] {
  return Array.from({ length: MD1_TOTAL_PARES }, (_, i) => {
    const atual = pares?.[i];
    const base = parVazioMD1(i);
    if (!atual) return base;
    return {
      slot: `T${i + 1}`,
      superior: {
        levantamento: atual.superior?.levantamento ?? base.superior.levantamento,
        rm1: Number(atual.superior?.rm1) || 0,
      },
      inferior: {
        levantamento: atual.inferior?.levantamento ?? base.inferior.levantamento,
        rm1: Number(atual.inferior?.rm1) || 0,
      },
      ordem: normalizarOrdemMD(atual.ordem),
      auxiliares: atual.auxiliares?.length ? atual.auxiliares : [],
    };
  });
}

export function emptyMileDeep1RM(): MileDeep1RMConteudo {
  return {
    variante: "MILEDEEP1RM",
    pares: normalizarParesMD1(undefined),
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    observacoes: "",
  };
}

/** Plano da semana daquele par. */
export function planoMD1(par: MD1Par, semana: number): MDPlanoSemana {
  return planoMD(par.ordem, semana, MD1_FAIXAS);
}

/** Tabela das 12 semanas daquele par. */
export function tabelaMD1(par: MD1Par): MDPlanoSemana[] {
  return tabelaMD(par.ordem, MD1_FAIXAS);
}

/** Levantamentos do par, na ordem inferior → superior. */
export function levantamentosDoParMD1(par: MD1Par): MD1LevConfig[] {
  return [par.inferior, par.superior];
}
