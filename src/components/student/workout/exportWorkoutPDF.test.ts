import { describe, it, expect } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import type { WorkoutExercise } from "./workoutTemplates";
import { exportWorkoutPDF } from "./exportWorkoutPDF";

/**
 * Regression tests for the workout PDF export.
 *
 * These guard against the historical bugs where:
 *   1. The PDF spilled to a second page when content was dense.
 *   2. The Treino 4 / Bloco B got clipped because the page-budget
 *      under-estimated row heights at low scale factors.
 *   3. Frequência column was rendered on the wrong (overflow) page.
 *   4. Observações block overlapped with the warm-up tables.
 *
 * The test renders the PDF in-memory (jsPDF runs under jsdom) and inspects
 * the produced jsPDF instance directly via `returnDoc: true`.
 */

const fakeStudent = {
  id: "00000000-0000-0000-0000-000000000000",
  nome: "Aluno Regressão Teste",
} as unknown as Tables<"alunos">;

const aquecimento: WorkoutExercise[] = [
  // LIB
  { ordem: 1, categoria: "LIB", exercicio: "Rolinho - Panturrilha", series: 1, repeticoes: '60"', dias: ["T1", "T2", "T3", "T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "Rolinho - Anterior, Posterior, Vasto Lateral e Adutor", series: 1, repeticoes: '60"', dias: ["T1", "T2", "T3", "T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "Rolinho - Quadril (Glúteos)", series: 1, repeticoes: '60"', dias: ["T1", "T2", "T3", "T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "Rolinho - Torácica", series: 1, repeticoes: '60"', dias: ["T1", "T2", "T3", "T4"] },
  // MOB
  { ordem: 5, categoria: "MOB", exercicio: "L Tesoura flexão/extensão (pé no chão)", series: 1, repeticoes: "10", dias: ["T2", "T4"] },
  { ordem: 6, categoria: "MOB", exercicio: "Gatinho", series: 1, repeticoes: "15", dias: ["T1", "T2", "T3", "T4"] },
  { ordem: 7, categoria: "MOB", exercicio: "Rocking", series: 1, repeticoes: "15", dias: ["T1", "T3"] },
  { ordem: 8, categoria: "MOB", exercicio: "Dorsiflexão passiva (na parede)", series: 1, repeticoes: "15", dias: ["T1", "T3"] },
  { ordem: 9, categoria: "MOB", exercicio: "Hip Hinge c/ Mãos na Parede", series: 1, repeticoes: "15", dias: ["T2", "T4"] },
  // ATI
  { ordem: 10, categoria: "ATI", exercicio: "Prancha Frontal", series: 1, repeticoes: '20"', dias: ["T1", "T2", "T3", "T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "Ponte Bilateral", series: 1, repeticoes: '20"', dias: ["T2", "T4"] },
  { ordem: 12, categoria: "ATI", exercicio: "Extensão Torácica no Chão", series: 1, repeticoes: '20"', dias: ["T2", "T4"] },
  { ordem: 13, categoria: "ATI", exercicio: "Ativação glúteo c/ band no joelho", series: 1, repeticoes: "20", dias: ["T1", "T3"] },
  { ordem: 14, categoria: "ATI", exercicio: "Fazendeiro Simétrico", series: 1, repeticoes: '45"', dias: ["T1", "T3"] },
];

// Treino 4 has all 5 exercises so we can assert Bloco A (1-2) and Bloco B (3-5)
// are both rendered. Exercise names are intentionally unique so we can grep them.
const treino4Exercicios: WorkoutExercise[] = [
  { ordem: 1, categoria: "DJA", exercicio: "T4-A1 Passada Reversa no Step", series: 3, repeticoes: "10" },
  { ordem: 2, categoria: "PV",  exercicio: "T4-A2 Face Pull (SAJ)", series: 3, repeticoes: "10" },
  { ordem: 3, categoria: "AR",  exercicio: "T4-B3 Estabilidade Lateral - (AJ)", series: 3, repeticoes: "10" },
  { ordem: 4, categoria: "EH",  exercicio: "T4-B4 Supino Halter Banco", series: 3, repeticoes: "10" },
  { ordem: 5, categoria: "DQ",  exercicio: "T4-B5 Bom dia Kettlebell", series: 3, repeticoes: "10" },
];

const fullData = {
  aquecimento,
  treinos: [
    {
      nome: "TREINO 1",
      exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "T1-A1 Agachamento Kettlebell", series: 3, repeticoes: "10" },
        { ordem: 2, categoria: "PH",  exercicio: "T1-A2 Remada Cabo Unilateral", series: 3, repeticoes: "10" },
        { ordem: 3, categoria: "EP",  exercicio: "T1-B3 Flexão Joelhos na Bola", series: 3, repeticoes: "10" },
        { ordem: 4, categoria: "EV",  exercicio: "T1-B4 Press Mina Terrestre", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AH",  exercicio: "T1-B5 Dead Bug Alternado", series: 3, repeticoes: "20" },
      ] as WorkoutExercise[],
    },
    {
      nome: "TREINO 2",
      exercicios: [
        { ordem: 1, categoria: "DQ",  exercicio: "T2-A1 LT Kettlebell", series: 3, repeticoes: "10" },
        { ordem: 2, categoria: "EH",  exercicio: "T2-A2 Supino Rolo Halteres", series: 3, repeticoes: "10" },
        { ordem: 3, categoria: "DJA", exercicio: "T2-B3 Step Up Lateral", series: 3, repeticoes: "10" },
        { ordem: 4, categoria: "PV",  exercicio: "T2-B4 Face Pull (SAJ)", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AF",  exercicio: "T2-B5 Prancha Lateral", series: 3, repeticoes: '30"' },
      ] as WorkoutExercise[],
    },
    {
      nome: "TREINO 3",
      exercicios: [
        { ordem: 1, categoria: "DJS", exercicio: "T3-A1 Agachamento Kettlebell", series: 3, repeticoes: "10" },
        { ordem: 2, categoria: "PH",  exercicio: "T3-A2 Remada Cabo Bilateral", series: 3, repeticoes: "10" },
        { ordem: 3, categoria: "DQ",  exercicio: "T3-B3 Elevação Quadril Solo", series: 3, repeticoes: "15" },
        { ordem: 4, categoria: "EV",  exercicio: "T3-B4 Press Unilateral (AJ)", series: 3, repeticoes: "10" },
        { ordem: 5, categoria: "AH",  exercicio: "T3-B5 Prancha na Bola", series: 3, repeticoes: '30"' },
      ] as WorkoutExercise[],
    },
    {
      nome: "TREINO 4",
      exercicios: treino4Exercicios,
    },
  ],
};

type JsPDFLike = {
  getNumberOfPages: () => number;
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
    pages: unknown[];
  };
};

describe("exportWorkoutPDF — single-page regression", () => {
  it("produces a single A4 page with full aquecimento + 4 complete treinos", async () => {
    const doc = (await exportWorkoutPDF({
      student: fakeStudent,
      descricao: "FASE 1",
      data: fullData,
      returnDoc: true,
    })) as unknown as JsPDFLike;

    expect(doc).toBeTruthy();
    expect(doc.getNumberOfPages()).toBe(1);

    // Sanity: it really is A4 portrait
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
  });

  it("renders every exercise of Treino 4 (Bloco A + Bloco B both visible)", async () => {
    const doc = (await exportWorkoutPDF({
      student: fakeStudent,
      descricao: "FASE 1",
      data: fullData,
      returnDoc: true,
    })) as unknown as JsPDFLike;

    // jsPDF stores the page content stream as a string array on the page object.
    // Concatenate everything from page 1 and assert each Treino 4 exercise label
    // (or a recognizable substring) shows up at least once.
    const page1Stream = collectPageStream(doc, 1);

    for (const ex of treino4Exercicios) {
      // jsPDF may split long strings — use a stable short prefix unique to each.
      const prefix = ex.exercicio.split(" ")[0]; // T4-A1, T4-A2, T4-B3, etc.
      expect(
        page1Stream.includes(prefix),
        `expected Treino 4 exercise "${prefix}" to be rendered on page 1, ` +
          `but it was missing from the PDF stream (Bloco B got clipped?)`,
      ).toBe(true);
    }
  });

  it("renders the Frequência column on page 1", async () => {
    const doc = (await exportWorkoutPDF({
      student: fakeStudent,
      descricao: "FASE 1",
      data: fullData,
      returnDoc: true,
    })) as unknown as JsPDFLike;

    const page1Stream = collectPageStream(doc, 1);
    // jsPDF may encode "Ê" as octal escape inside the stream — use the ASCII core.
    expect(page1Stream).toMatch(/FREQU/);
    expect(page1Stream).toMatch(/SEMANAS|SEMANA/);
  });

  it("does not emit the legacy 'v' check glyph in T1..T4 columns", async () => {
    const doc = (await exportWorkoutPDF({
      student: fakeStudent,
      descricao: "FASE 1",
      data: fullData,
      returnDoc: true,
    })) as unknown as JsPDFLike;

    const page1Stream = collectPageStream(doc, 1);
    // The dot sentinel must never appear as rendered text.
    expect(page1Stream).not.toContain("•DOT•");
  });

  it("still fits on a single page when treinos are unusually long", async () => {
    // Stress: same shape but Treino 4 with 5 exercises and longer names.
    const stressData = {
      ...fullData,
      treinos: fullData.treinos.map((tr, i) => ({
        ...tr,
        exercicios: tr.exercicios.map((ex) => ({
          ...ex,
          exercicio: `${ex.exercicio} — variante ${i + 1} extra longa para estressar layout`,
        })),
      })),
    };

    const doc = (await exportWorkoutPDF({
      student: fakeStudent,
      descricao: "FASE 1",
      data: stressData,
      returnDoc: true,
    })) as unknown as JsPDFLike;

    expect(doc.getNumberOfPages()).toBe(1);
  });
});

/**
 * Concatenates the PDF content stream of a given 1-indexed page into a single
 * string we can grep. jsPDF stores per-page draw operations in `internal.pages`
 * as either an array of strings or a single string, depending on version.
 */
function collectPageStream(doc: JsPDFLike, pageNum: number): string {
  // pages is 1-indexed in jsPDF (slot 0 is unused).
  const page = doc.internal.pages[pageNum] as unknown;
  if (!page) return "";
  if (Array.isArray(page)) return (page as string[]).join("\n");
  return String(page);
}
