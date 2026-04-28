// Tipos do treino "Personalizado" (Banco de Treinos > Métodos > Personalizado).
// Estrutura suporta aquecimento flexível (LIB/MOB/ATI com contagens livres),
// múltiplos treinos, múltiplos blocos por treino e exercícios com montagem
// SIMPLES (1 exercício por linha) ou DINÂMICA (X/Y por semana, ou rotação N).

import type { WorkoutExercise } from "./workoutTemplates";

export type AquecimentoBloco = "LIB" | "MOB" | "ATI";

export interface PersonalizadoAquecimentoEx {
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  repeticoes: string;
  dias: string[]; // T1..T4 (ou mais)
}

export type DinamicoRotacao = "impar_par" | "rotativa";
export type DinamicoSeriesModo = "compartilhado" | "independente";

export interface DinamicoVariante {
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series?: number | string;
  repeticoes?: string;
}

export interface PersonalizadoExercicioSimples {
  tipo: "simples";
  categoria: string;
  exercicio: string;
  exercicio_id?: string | null;
  video_url?: string | null;
  series: number | string;
  repeticoes: string;
}

export interface PersonalizadoExercicioDinamico {
  tipo: "dinamico";
  categoria: string;
  rotacao: DinamicoRotacao;
  series_modo: DinamicoSeriesModo;
  series: number | string; // usado quando series_modo = compartilhado
  repeticoes: string;       // idem
  variantes: DinamicoVariante[];
}

export type PersonalizadoExercicio =
  | PersonalizadoExercicioSimples
  | PersonalizadoExercicioDinamico;

export interface PersonalizadoBloco {
  nome: string; // "Bloco A", "Bloco B"...
  exercicios: PersonalizadoExercicio[];
}

export interface PersonalizadoTreino {
  nome: string; // "Treino 1", "Treino 2"...
  blocos: PersonalizadoBloco[];
}

export interface PersonalizadoConteudo {
  aquecimento: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  treinos: PersonalizadoTreino[];
  observacoes: string;
}

// Marca usada em treinos.conteudo para identificar o shape novo
export interface PersonalizadoTreinoConteudo {
  __personalizado: true;
  estrutura: PersonalizadoConteudo;
  // Forma plana, retrocompatível com o renderer/PDF atual
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

export function emptyPersonalizado(): PersonalizadoConteudo {
  return {
    aquecimento: { LIB: [], MOB: [], ATI: [] },
    treinos: [
      {
        nome: "Treino 1",
        blocos: [
          {
            nome: "Bloco A",
            exercicios: [],
          },
        ],
      },
    ],
    observacoes: "",
  };
}

/** Serializa a estrutura rica em WorkoutData (formato esperado pelo PDF). */
export function flattenPersonalizado(c: PersonalizadoConteudo): {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
} {
  const aquecimento: WorkoutExercise[] = [];
  let ord = 1;
  (["LIB", "MOB", "ATI"] as AquecimentoBloco[]).forEach((bloco) => {
    c.aquecimento[bloco]?.forEach((ex) => {
      aquecimento.push({
        ordem: ord++,
        categoria: bloco,
        exercicio: ex.exercicio || "",
        series: 1,
        repeticoes: ex.repeticoes || "",
        dias: ex.dias || [],
        exercicio_id: ex.exercicio_id || undefined,
        video_url: ex.video_url || null,
      });
    });
  });

  const treinos = c.treinos.map((tr) => {
    const exercicios: WorkoutExercise[] = [];
    let n = 1;
    tr.blocos.forEach((bloco) => {
      bloco.exercicios.forEach((ex) => {
        if (ex.tipo === "simples") {
          exercicios.push({
            ordem: n++,
            categoria: ex.categoria || "",
            exercicio: ex.exercicio || "",
            series: ex.series ?? "",
            repeticoes: ex.repeticoes || "",
            exercicio_id: ex.exercicio_id || undefined,
            video_url: ex.video_url || null,
          });
        } else {
          // Dinâmico → uma linha com "X / Y / Z"
          const nomes = ex.variantes
            .map((v) => v.exercicio?.trim())
            .filter(Boolean)
            .join(" / ");
          const tag = ex.rotacao === "impar_par" ? "[ímpar/par] " : "[rotativa] ";
          let series: number | string = ex.series ?? "";
          let repeticoes = ex.repeticoes || "";
          if (ex.series_modo === "independente") {
            const seriesArr = ex.variantes.map((v) => String(v.series ?? "").trim()).filter(Boolean);
            const repsArr = ex.variantes.map((v) => String(v.repeticoes ?? "").trim()).filter(Boolean);
            if (seriesArr.length) series = seriesArr.join(" / ");
            if (repsArr.length) repeticoes = repsArr.join(" / ");
          }
          exercicios.push({
            ordem: n++,
            categoria: ex.categoria || "",
            exercicio: tag + (nomes || "—"),
            series,
            repeticoes,
            video_url: ex.variantes[0]?.video_url || null,
          });
        }
      });
    });
    return { nome: tr.nome, exercicios };
  });

  return { aquecimento, treinos };
}

/** Detecta se um conteúdo de `treinos.conteudo` é Personalizado (shape novo). */
export function isPersonalizadoContent(
  raw: unknown,
): raw is PersonalizadoTreinoConteudo {
  return !!raw && typeof raw === "object" && (raw as { __personalizado?: boolean }).__personalizado === true;
}
