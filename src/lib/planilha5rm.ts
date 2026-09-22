// Planilha 5RM — método simples: estrutura fixa + cargas preenchidas à mão.
// Não há 1RM nem cálculo automático de carga: o professor/aluno escreve o KG
// de cada semana (S1..S4). Volume/intensidade é referência fixa do método.

import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";

export type Frequencia5RM = 2 | 3 | 4;

export const PLANILHA5RM_FREQ_OPTIONS: Frequencia5RM[] = [2, 3, 4];

/** Quantidade fixa de exercícios por bloco. */
export const PLANILHA5RM_QTD_BLOCO_PRINCIPAL = 2;
export const PLANILHA5RM_QTD_BLOCO_ACESSORIO = 3;

export const PLANILHA5RM_BLOCO_PRINCIPAL_LABEL = "Padrões Básicos";
export const PLANILHA5RM_BLOCO_ACESSORIO_LABEL = "Padrões Acessórios";

/** Referência fixa de volume/intensidade (não editável). */
export const PLANILHA5RM_VOLUME_PRINCIPAL: { semana: 1 | 2 | 3 | 4; texto: string }[] = [
  { semana: 1, texto: "4x5 @8RM" },
  { semana: 2, texto: "4x5 @7RM" },
  { semana: 3, texto: "4x5 @6RM" },
  { semana: 4, texto: "4x5 @5RM" },
];
export const PLANILHA5RM_VOLUME_PRINCIPAL_NOTA = "+2,5%/sem";
export const PLANILHA5RM_VOLUME_ACESSORIO = "3x8 @10-12RM";

export interface ExercicioPlanilha5RM {
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  /** KG de cada semana (S1..S4), preenchido manualmente. */
  kgSemanas: [string, string, string, string];
}

export interface TreinoPlanilha5RM {
  ordem: number;
  blocoPrincipal: ExercicioPlanilha5RM[];
  blocoAcessorio: ExercicioPlanilha5RM[];
}

export interface Planilha5RMConteudo {
  __planilha5rm: true;
  frequencia: Frequencia5RM;
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: TreinoPlanilha5RM[];
  observacoes: string;
}

export function exercicioVazio5RM(): ExercicioPlanilha5RM {
  return {
    categoria: "",
    exercicio: "",
    exercicio_id: null,
    video_url: null,
    kgSemanas: ["", "", "", ""],
  };
}

export function treinoVazio5RM(ordem: number): TreinoPlanilha5RM {
  return {
    ordem,
    blocoPrincipal: Array.from({ length: PLANILHA5RM_QTD_BLOCO_PRINCIPAL }, exercicioVazio5RM),
    blocoAcessorio: Array.from({ length: PLANILHA5RM_QTD_BLOCO_ACESSORIO }, exercicioVazio5RM),
  };
}

/** Garante a contagem fixa de exercícios de um bloco. */
export function ajustarBloco5RM(
  lista: ExercicioPlanilha5RM[] | undefined,
  quantidade: number,
): ExercicioPlanilha5RM[] {
  const base = lista ?? [];
  return Array.from({ length: quantidade }, (_, i) => base[i] ?? exercicioVazio5RM());
}

export function emptyPlanilha5RM(frequencia: Frequencia5RM = 3): Planilha5RMConteudo {
  return {
    __planilha5rm: true,
    frequencia,
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
    treinos: Array.from({ length: frequencia }, (_, i) => treinoVazio5RM(i + 1)),
    observacoes: "",
  };
}

export function isPlanilha5RMContent(raw: unknown): raw is Planilha5RMConteudo {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as { __planilha5rm?: boolean }).__planilha5rm === true
  );
}
