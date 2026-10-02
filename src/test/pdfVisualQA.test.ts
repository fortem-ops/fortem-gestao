import { beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import { exportWorkoutPDF } from "@/components/student/workout/exportWorkoutPDF";
import { exportWendler531PDF } from "@/components/student/workout/exportWendler531PDF";
import { exportM102PDF } from "@/components/student/workout/exportM102PDF";
import { exportPlanStrongPDF } from "@/components/student/workout/exportPlanStrongPDF";
import { exportPlanilha5RMPDF } from "@/components/student/workout/exportPlanilha5RMPDF";
import { exportXFabPDF } from "@/components/student/workout/exportXFabPDF";
import { exportPTTPPDF } from "@/components/student/workout/exportPTTPPDF";
import { exportPTTP2PDF } from "@/components/student/workout/exportPTTP2PDF";
import { exportFoolproofPDF } from "@/components/student/workout/exportFoolproofPDF";
import { exportEasyStrengthPDF } from "@/components/student/workout/exportEasyStrengthPDF";
import { exportMileDeep1RMPDF } from "@/components/student/workout/exportMileDeep1RMPDF";
import { exportMileDeep5RMPDF } from "@/components/student/workout/exportMileDeep5RMPDF";
import { emptyWendler531 } from "@/lib/wendler531";
import { emptyM102 } from "@/lib/m102";
import { emptyPlanStrong50 } from "@/lib/planStrong";
import { emptyPlanilha5RM } from "@/lib/planilha5rm";
import { emptyXFab } from "@/lib/xfab";
import { emptyPTTP } from "@/lib/pttp";
import { emptyPTTP2 } from "@/lib/pttp2";
import { emptyFoolproof } from "@/lib/foolproof";
import { emptyEasyStrength } from "@/lib/easyStrength";
import { emptyMileDeep1RM } from "@/lib/mileDeep1RM";
import { emptyMileDeep5RM } from "@/lib/mileDeep5RM";

const OUT = "/tmp/pdf-qa";
const student = { id: "00000000-0000-0000-0000-000000000000", nome: "Aluno Validação Visual" } as Tables<"alunos">;
const observations = "Observação da prescrição: priorizar técnica, controlar a descida e registrar a carga utilizada.";
const warmup = {
  LIB: [{ subcategoria: "Quadril", exercicio: "Liberação miofascial", repeticoes: "60s", dias: ["T1", "T2", "T3", "T4"] }],
  MOB: [{ subcategoria: "Tornozelo", exercicio: "Mobilidade de tornozelo", repeticoes: "10", dias: ["T1", "T3"] }],
  ATI: [{ subcategoria: "Core", exercicio: "Prancha frontal", repeticoes: "30s", dias: ["T2", "T4"] }],
  PREV: [{ subcategoria: "Ombro", exercicio: "Rotação externa", repeticoes: "12", dias: ["T1", "T2", "T3"] }],
  POT: [{ subcategoria: "Salto", exercicio: "Salto vertical", repeticoes: "5", dias: ["T1", "T3"] }],
};

beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function capture(name: string, run: () => Promise<void>) {
  const api = jsPDF.API as typeof jsPDF.API & { save: (filename?: string) => jsPDF };
  const original = api.save;
  api.save = function () {
    writeFileSync(`${OUT}/${name}.pdf`, Buffer.from(this.output("arraybuffer")));
    return this;
  };
  try {
    await run();
  } finally {
    api.save = original;
  }
}

describe("PDF visual QA fixtures", () => {
  it("generates all 12 real PDFs", async () => {
    const personalizado = await exportWorkoutPDF({
      student,
      descricao: "PERSONALIZADO",
      data: {
        observacoes: observations,
        aquecimento: Object.entries(warmup).flatMap(([categoria, rows]) => rows.map((row, i) => ({ ...row, categoria, ordem: i + 1, series: 1 }))),
        treinos: Array.from({ length: 4 }, (_, treino) => ({
          nome: `TREINO ${treino + 1}`,
          exercicios: Array.from({ length: 5 }, (_, i) => ({ ordem: i + 1, categoria: "FOR", exercicio: `Exercício de força ${treino + 1}.${i + 1}`, series: 3, repeticoes: "8" })),
        })),
      },
      returnDoc: true,
    });
    if (!personalizado) throw new Error("PDF personalizado não gerado");
    writeFileSync(`${OUT}/01-personalizado.pdf`, Buffer.from(personalizado.output("arraybuffer")));

    const jobs: Array<[string, () => Promise<void>]> = [
      ["02-wendler531", () => exportWendler531PDF({ student, data: { ...emptyWendler531(4), aquecimento: warmup, observacoes: observations } })],
      ["03-m102", () => exportM102PDF({ student, data: { ...emptyM102(), aquecimento: warmup, observacoes: observations } })],
      ["04-planstrong50", () => exportPlanStrongPDF({ student, data: { ...emptyPlanStrong50(6), aquecimento: warmup, observacoes: observations } })],
      ["05-planilha5rm", () => exportPlanilha5RMPDF({ student, data: { ...emptyPlanilha5RM(4), aquecimento: warmup, observacoes: observations } })],
      ["06-xfab", () => exportXFabPDF({ student, data: { ...emptyXFab(), aquecimento: warmup, observacoes: observations } })],
      ["07-pttp", () => exportPTTPPDF({ student, data: { ...emptyPTTP(), aquecimento: warmup, observacoes: observations } })],
      ["08-pttp2", () => exportPTTP2PDF({ student, data: { ...emptyPTTP2(), aquecimento: warmup, observacoes: observations } })],
      ["09-foolproof", () => exportFoolproofPDF({ student, data: { ...emptyFoolproof(5), aquecimento: warmup, observacoes: observations } })],
      ["10-easystrength", () => exportEasyStrengthPDF({ student, data: { ...emptyEasyStrength(3), aquecimento: warmup, observacoes: observations } })],
      ["11-miledeep1rm", () => exportMileDeep1RMPDF({ student, data: { ...emptyMileDeep1RM(), aquecimento: warmup, observacoes: observations } })],
      ["12-miledeep5rm", () => exportMileDeep5RMPDF({ student, data: { ...emptyMileDeep5RM(), aquecimento: warmup, observacoes: observations } })],
    ];
    for (const [name, run] of jobs) await capture(name, run);
    expect(jobs).toHaveLength(11);
  });
});