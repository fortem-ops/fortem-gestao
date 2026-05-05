// Tipos do treino "Personalizado" (Banco de Treinos > Métodos > Personalizado).
// Estrutura suporta aquecimento flexível (LIB/MOB/ATI com contagens livres),
// múltiplos treinos, múltiplos blocos por treino e exercícios com montagem
// SIMPLES (1 exercício por linha) ou DINÂMICA (X/Y por semana, ou rotação N).

import type { WorkoutExercise } from "./workoutTemplates";

export type AquecimentoBloco = "LIB" | "MOB" | "ATI" | "PREV";

export interface PersonalizadoAquecimentoEx {
  subcategoria?: string;
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
    aquecimento: { LIB: [], MOB: [], ATI: [], PREV: [] },
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
  (["LIB", "MOB", "ATI", "PREV"] as AquecimentoBloco[]).forEach((bloco) => {
    c.aquecimento[bloco]?.forEach((ex) => {
      aquecimento.push({
        ordem: ord++,
        categoria: bloco,
        subcategoria: ex.subcategoria || undefined,
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
    tr.blocos.forEach((bloco, blocoIdx) => {
      let firstOfBloco = true;
      const blocoLabel = bloco.nome || `Bloco ${String.fromCharCode(65 + blocoIdx)}`;
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
            blocoStart: firstOfBloco ? blocoLabel : undefined,
          });
          firstOfBloco = false;
        } else {
          // Dinâmico → uma linha por variante (para o PDF/renderer alternar
          // cores por semana, espelhando o bloco de Frequência).
          const tag: "I/P" | "ROT" = ex.rotacao === "impar_par" ? "I/P" : "ROT";
          const variantes = ex.variantes.length > 0 ? ex.variantes : [{ exercicio: "—" } as DinamicoVariante];
          variantes.forEach((v, i) => {
            const seriesVal = ex.series_modo === "independente"
              ? (v.series ?? "")
              : (ex.series ?? "");
            const repsVal = ex.series_modo === "independente"
              ? (v.repeticoes ?? "")
              : (ex.repeticoes ?? "");
            exercicios.push({
              ordem: n++,
              categoria: ex.categoria || "",
              exercicio: (v.exercicio?.trim() || "—"),
              series: seriesVal,
              repeticoes: repsVal,
              exercicio_id: v.exercicio_id || undefined,
              video_url: v.video_url || null,
              dinamicoIndex: i,
              dinamicoTotal: variantes.length,
              dinamicoTag: i === 0 ? tag : undefined,
              blocoStart: firstOfBloco && i === 0 ? blocoLabel : undefined,
            });
          });
          firstOfBloco = false;
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

/**
 * Converte qualquer conteúdo de `treinos.conteudo` em PersonalizadoConteudo,
 * para servir como `initial` ao PersonalizadoEditor.
 *
 * - Se já for Personalizado, retorna a estrutura rica.
 * - Se for o shape plano (templates Fases/Métodos/Corrida), remonta como
 *   um único "Bloco A" por treino, com exercícios do tipo "simples".
 * - Aquecimento plano é distribuído em LIB/MOB/ATI conforme a categoria.
 */
export function personalizadoFromFlat(raw: unknown): PersonalizadoConteudo {
  if (isPersonalizadoContent(raw)) {
    return raw.estrutura;
  }

  const base = emptyPersonalizado();
  if (!raw || typeof raw !== "object") return base;

  const r = raw as {
    aquecimento?: WorkoutExercise[];
    treinos?: { nome: string; exercicios: WorkoutExercise[] }[];
  };

  // Aquecimento → distribuir nos blocos LIB/MOB/ATI
  const aquec: PersonalizadoConteudo["aquecimento"] = { LIB: [], MOB: [], ATI: [], PREV: [] };
  (r.aquecimento || []).forEach((ex) => {
    const cat = (ex.categoria || "").toUpperCase();
    const bloco: AquecimentoBloco | null =
      cat === "LIB" || cat === "MOB" || cat === "ATI" || cat === "PREV" ? (cat as AquecimentoBloco) : null;
    if (!bloco) return;
    aquec[bloco].push({
      subcategoria: ex.subcategoria,
      exercicio: ex.exercicio || "",
      exercicio_id: ex.exercicio_id || null,
      video_url: ex.video_url || null,
      repeticoes: String(ex.repeticoes ?? ""),
      dias: ex.dias && ex.dias.length > 0 ? ex.dias : ["T1", "T2", "T3", "T4"],
    });
  });

  // Treinos → cada treino vira 1 bloco "Bloco A" com exercícios simples
  const treinos: PersonalizadoConteudo["treinos"] = (r.treinos || []).map((t, idx) => ({
    nome: t.nome || `Treino ${idx + 1}`,
    blocos: [
      {
        nome: "Bloco A",
        exercicios: (t.exercicios || []).map<PersonalizadoExercicioSimples>((ex) => ({
          tipo: "simples",
          categoria: ex.categoria || "DJS",
          exercicio: ex.exercicio || "",
          exercicio_id: ex.exercicio_id || null,
          video_url: ex.video_url || null,
          series: ex.series ?? 3,
          repeticoes: String(ex.repeticoes ?? ""),
        })),
      },
    ],
  }));

  return {
    aquecimento: aquec,
    treinos: treinos.length > 0 ? treinos : base.treinos,
    observacoes: "",
  };
}
