import { describe, it } from "vitest";
import { exportWorkoutPDF } from "@/components/student/workout/exportWorkoutPDF";

const fakeStudent = { id: "x", nome: "Aluno Teste" } as any;

const aquecimento: any = [
  { ordem: 1, categoria: "LIB", exercicio: "Rolinho - Panturrilha", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 2, categoria: "LIB", exercicio: "Rolinho - Anterior", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 3, categoria: "LIB", exercicio: "Rolinho - Quadril", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 4, categoria: "LIB", exercicio: "Rolinho - Torácica", series: 1, repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
  { ordem: 5, categoria: "MOB", exercicio: "L Tesoura", series: 1, repeticoes: "10", dias: ["T2","T4"] },
  { ordem: 6, categoria: "MOB", exercicio: "Gatinho", series: 1, repeticoes: "15", dias: ["T1","T2","T3","T4"] },
  { ordem: 7, categoria: "MOB", exercicio: "Rocking", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 8, categoria: "MOB", exercicio: "Dorsiflexão", series: 1, repeticoes: "15", dias: ["T1","T3"] },
  { ordem: 9, categoria: "MOB", exercicio: "Hip Hinge", series: 1, repeticoes: "15", dias: ["T2","T4"] },
  { ordem: 10, categoria: "ATI", exercicio: "Prancha Frontal", series: 1, repeticoes: '20"', dias: ["T1","T2","T3","T4"] },
  { ordem: 11, categoria: "ATI", exercicio: "Ponte", series: 1, repeticoes: '20"', dias: ["T2","T4"] },
  { ordem: 12, categoria: "ATI", exercicio: "Extensão Torácica", series: 1, repeticoes: '20"', dias: ["T2","T4"] },
  { ordem: 13, categoria: "ATI", exercicio: "Ativação glúteo", series: 1, repeticoes: "20", dias: ["T1","T3"] },
  { ordem: 14, categoria: "ATI", exercicio: "Fazendeiro", series: 1, repeticoes: '45"', dias: ["T1","T3"] },
];

const treinos = [1,2,3,4].map(n => ({
  nome: `TREINO ${n}`,
  exercicios: [
    { ordem: 1, categoria: "DJS", exercicio: `T${n}-A1 Ex`, series: 3, repeticoes: "10" },
    { ordem: 2, categoria: "PH",  exercicio: `T${n}-A2 Ex`, series: 3, repeticoes: "10" },
    { ordem: 3, categoria: "EP",  exercicio: `T${n}-B3 Ex`, series: 3, repeticoes: "10" },
    { ordem: 4, categoria: "EV",  exercicio: `T${n}-B4 Ex`, series: 3, repeticoes: "10" },
    { ordem: 5, categoria: "AH",  exercicio: `T${n}-B5 Ex`, series: 3, repeticoes: "20" },
  ] as any,
}));

describe("debug", () => {
  it("dump", async () => {
    const doc: any = await exportWorkoutPDF({ student: fakeStudent, descricao: "F", data: { aquecimento, treinos }, returnDoc: true });
    console.log("pages:", doc.getNumberOfPages());
    const stream = (Array.isArray(doc.internal.pages[1]) ? doc.internal.pages[1].join("\n") : String(doc.internal.pages[1]));
    for (const p of ["T4-A1","T4-A2","T4-B3","T4-B4","T4-B5","T3-B5","T1-A1"]) {
      console.log(p, stream.includes(p));
    }
  });
});
