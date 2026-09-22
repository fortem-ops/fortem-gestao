/**
 * X-FAB Hipertrofia — 3 treinos/semana, estrutura fixa.
 *
 * Regras:
 * - 3 pares de levantamentos básicos que se revezam entre os 3 treinos:
 *   Par A = Terra + Press (T1, T2) · Par B = Agachamento + Supino (T1, T3)
 *   Par C = Pullup* + Serrote* (T2, T3).
 * - Cada treino tem 4 blocos de 2 exercícios em série alternada: 2 blocos de
 *   levantamentos básicos (os pares daquele treino) + 2 blocos de auxiliares
 *   (categoria travada, exercício livre).
 * - Tabela fixa de 12 sessões (séries/reps/% ou RM), igual para todos.
 * - KG só é calculado para os levantamentos com 1RM (Terra, Press,
 *   Agachamento, Supino) = 1RM × %, arredondado ao múltiplo de 2,5kg.
 *   Levantamentos com * e auxiliares mostram só o alvo em RM (KG manual).
 * - Progresso: a sessão atual de cada PAR é a soma das sessões concluídas dos
 *   dois treinos em que ele aparece. Os auxiliares seguem a contagem do seu
 *   próprio treino (não trocam de treino).
 */

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { roundToNearest2_5 } from "@/lib/m102";

export type XFabLevantamento =
  | "Terra"
  | "Press"
  | "Agachamento"
  | "Supino"
  | "Pullup"
  | "Serrote";

export type XFabPar = "A" | "B" | "C";
export type XFabTreinoOrdem = 1 | 2 | 3;
export type XFabSlot = "T1" | "T2" | "T3";

/** Exercício do Banco vinculado a cada levantamento básico. */
export const XFAB_LEV_BASE: Record<
  XFabLevantamento,
  {
    categoria: string;
    exercicio_id: string;
    nome: string;
    video_url: string | null;
    /** true = carga calculada a partir do 1RM; false = alvo em RM (KG manual). */
    comRM1: boolean;
    label: string;
  }
> = {
  Terra: {
    categoria: "DQ",
    exercicio_id: "64cf35a1-03b0-4b89-b46f-3a893dbf65cc",
    nome: "Levantamento Terra com Barra Reta",
    video_url: "https://www.youtube.com/watch?v=H6QBUUGcOo8",
    comRM1: true,
    label: "Terra",
  },
  Press: {
    categoria: "EV",
    exercicio_id: "304266f3-1a23-435b-9d21-703d00b0db8b",
    nome: "Press com Barra (SM)",
    video_url: "https://youtube.com/shorts/G9O1KSUUY7Q",
    comRM1: true,
    label: "Press",
  },
  Agachamento: {
    categoria: "DJS",
    exercicio_id: "0c0bdc0c-0df0-4999-bbe7-0c85471d4b34",
    nome: "Agachamento com Barra nas Costas",
    video_url: "https://youtube.com/shorts/LGnX-Tit8NY",
    comRM1: true,
    label: "Agachamento",
  },
  Supino: {
    categoria: "EH",
    exercicio_id: "2f8139b2-d0cc-4f34-8b2c-396b5e0a039f",
    nome: "Supino",
    video_url: "https://www.youtube.com/watch?v=Eas2ERzSBTs",
    comRM1: true,
    label: "Supino",
  },
  Pullup: {
    categoria: "PV",
    exercicio_id: "b5497476-9052-4032-8204-71bd5506aa1f",
    nome: "7- Pull Up",
    video_url: "https://youtube.com/shorts/9gvqb7FFhLw",
    comRM1: false,
    label: "Pullup*",
  },
  Serrote: {
    categoria: "PH",
    exercicio_id: "9ddc3a0f-c802-421d-b732-a9da8ccefc12",
    nome: "9- Serrote Unilateral sem Apoio",
    video_url: "https://youtube.com/shorts/8fkvdFU3Qtc",
    comRM1: false,
    label: "Serrote*",
  },
};

/** Composição fixa de cada par. */
export const XFAB_PARES: Record<XFabPar, [XFabLevantamento, XFabLevantamento]> = {
  A: ["Terra", "Press"],
  B: ["Agachamento", "Supino"],
  C: ["Pullup", "Serrote"],
};

/** Treinos em que cada par aparece. */
export const XFAB_PAR_TREINOS: Record<XFabPar, XFabTreinoOrdem[]> = {
  A: [1, 2],
  B: [1, 3],
  C: [2, 3],
};

/** Pares (na ordem em que aparecem) e categorias travadas dos auxiliares. */
export const XFAB_TREINOS: Record<
  XFabTreinoOrdem,
  { pares: [XFabPar, XFabPar]; auxiliares: [[string, string], [string, string]] }
> = {
  1: { pares: ["A", "B"], auxiliares: [["DQ", "EV"], ["DJS", "EH"]] },
  2: { pares: ["C", "A"], auxiliares: [["PV", "PH"], ["DQ", "EV"]] },
  3: { pares: ["B", "C"], auxiliares: [["DJS", "EH"], ["PV", "PH"]] },
};

export const XFAB_TOTAL_SESSOES = 12;

export interface XFabSessaoPlano {
  sessao: number; // 1..12
  /** Esquema de séries/reps, ex.: "2x5" ou "2,3,2,3". */
  esquema: string;
  /** % do 1RM dos levantamentos básicos sem *. */
  pct: number;
  /** Alvo em RM dos levantamentos com *. */
  rmAlvo: number;
  /** Alvo completo dos auxiliares, ex.: "3x6 @10RM". */
  auxiliar: string;
}

/** Tabela fixa das 12 sessões (não editável). */
export const XFAB_SESSOES: XFabSessaoPlano[] = [
  { sessao: 1, esquema: "2x5", pct: 70, rmAlvo: 10, auxiliar: "3x6 @10RM" },
  { sessao: 2, esquema: "5x2", pct: 85, rmAlvo: 5, auxiliar: "5x3 @5RM" },
  { sessao: 3, esquema: "2x5", pct: 75, rmAlvo: 8, auxiliar: "4x5 @8RM" },
  { sessao: 4, esquema: "3x3", pct: 80, rmAlvo: 6, auxiliar: "5x4 @6RM" },
  { sessao: 5, esquema: "2x5", pct: 70, rmAlvo: 10, auxiliar: "3x6 @10RM" },
  { sessao: 6, esquema: "6x1", pct: 90, rmAlvo: 3, auxiliar: "5x3 @5RM" },
  { sessao: 7, esquema: "2x5", pct: 75, rmAlvo: 8, auxiliar: "4x5 @8RM" },
  { sessao: 8, esquema: "2,3,2,3", pct: 85, rmAlvo: 5, auxiliar: "5x4 @6RM" },
  { sessao: 9, esquema: "2x5", pct: 70, rmAlvo: 10, auxiliar: "3x6 @10RM" },
  { sessao: 10, esquema: "2,3,2,3", pct: 85, rmAlvo: 5, auxiliar: "5x3 @5RM" },
  { sessao: 11, esquema: "2x5", pct: 75, rmAlvo: 8, auxiliar: "4x5 @8RM" },
  { sessao: 12, esquema: "3,4,3", pct: 80, rmAlvo: 6, auxiliar: "5x4 @6RM" },
];

export interface XFabRm {
  terra: number;
  press: number;
  agachamento: number;
  supino: number;
}

export interface XFabAuxExercicio {
  categoria: string; // travada pela estrutura
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
}

export interface XFabTreino {
  ordem: XFabTreinoOrdem;
  /** 2 blocos × 2 exercícios auxiliares. */
  blocosAuxiliares: XFabAuxExercicio[][];
}

export interface XFabConteudo {
  variante: "XFAB";
  rm: XFabRm;
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: XFabTreino[]; // 3 fixos
  observacoes: string;
}

export function isXFabContent(raw: unknown): raw is XFabConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { variante?: unknown }).variante === "XFAB"
  );
}

function auxVazio(categoria: string): XFabAuxExercicio {
  return { categoria, exercicio: "", exercicio_id: null, video_url: null };
}

export function treinoVazioXFab(ordem: XFabTreinoOrdem): XFabTreino {
  return {
    ordem,
    blocosAuxiliares: XFAB_TREINOS[ordem].auxiliares.map((bloco) =>
      bloco.map((cat) => auxVazio(cat)),
    ),
  };
}

/** Garante a estrutura fixa (3 treinos × 2 blocos × 2 auxiliares com categoria travada). */
export function normalizarTreinosXFab(treinos: XFabTreino[] | undefined): XFabTreino[] {
  return ([1, 2, 3] as XFabTreinoOrdem[]).map((ordem) => {
    const atual = treinos?.find((t) => t.ordem === ordem);
    const cats = XFAB_TREINOS[ordem].auxiliares;
    return {
      ordem,
      blocosAuxiliares: cats.map((bloco, bi) =>
        bloco.map((cat, ei) => {
          const ex = atual?.blocosAuxiliares?.[bi]?.[ei];
          return ex ? { ...ex, categoria: cat } : auxVazio(cat);
        }),
      ),
    };
  });
}

export function emptyXFab(): XFabConteudo {
  return {
    variante: "XFAB",
    rm: { terra: 0, press: 0, agachamento: 0, supino: 0 },
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    treinos: normalizarTreinosXFab(undefined),
    observacoes: "",
  };
}

export function kgXFab(rm: number, pct: number): number {
  if (!rm) return 0;
  return roundToNearest2_5((rm * pct) / 100);
}

export function rmDoLevantamento(rm: XFabRm, lev: XFabLevantamento): number {
  switch (lev) {
    case "Terra":
      return rm.terra;
    case "Press":
      return rm.press;
    case "Agachamento":
      return rm.agachamento;
    case "Supino":
      return rm.supino;
    default:
      return 0;
  }
}

export type XFabContagemTreinos = Record<XFabSlot, number>;

/** Sessões concluídas de um par = soma dos dois treinos em que ele aparece. */
export function sessoesConcluidasPar(
  counts: XFabContagemTreinos,
  par: XFabPar,
): number {
  return XFAB_PAR_TREINOS[par].reduce(
    (acc, t) => acc + (counts[`T${t}` as XFabSlot] ?? 0),
    0,
  );
}

export type XFabStatusPar =
  | { phase: "regular"; done: number; proxima: XFabSessaoPlano }
  | { phase: "concluded"; done: number };

export function statusPar(counts: XFabContagemTreinos, par: XFabPar): XFabStatusPar {
  const done = sessoesConcluidasPar(counts, par);
  if (done >= XFAB_TOTAL_SESSOES) return { phase: "concluded", done };
  return { phase: "regular", done, proxima: XFAB_SESSOES[done] };
}

/** Sessão dos auxiliares de um treino = contagem daquele treino específico. */
export function sessaoAuxiliar(
  counts: XFabContagemTreinos,
  ordem: XFabTreinoOrdem,
): XFabSessaoPlano | null {
  const done = counts[`T${ordem}` as XFabSlot] ?? 0;
  return done >= XFAB_TOTAL_SESSOES ? null : XFAB_SESSOES[done];
}

/** Texto do alvo de um levantamento na sessão informada. */
export function alvoLevantamento(
  lev: XFabLevantamento,
  plano: XFabSessaoPlano,
  rm: XFabRm,
): { alvo: string; kg: number | null } {
  const base = XFAB_LEV_BASE[lev];
  if (!base.comRM1) {
    return { alvo: `${plano.esquema} @${plano.rmAlvo}RM`, kg: null };
  }
  const valor = rmDoLevantamento(rm, lev);
  return {
    alvo: `${plano.esquema} @${plano.pct}%`,
    kg: kgXFab(valor, plano.pct),
  };
}

export const XFAB_MENSAGEM_CONCLUIDO = "Programa concluído — procure o professor.";
