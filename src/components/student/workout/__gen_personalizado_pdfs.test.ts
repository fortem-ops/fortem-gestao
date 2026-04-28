import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { exportWorkoutPDF } from "./exportWorkoutPDF";
import { flattenPersonalizado, type PersonalizadoConteudo } from "./personalizadoTypes";
import type { Tables } from "@/integrations/supabase/types";

const student = { id: "x", nome: "Aluno Teste Personalizado" } as unknown as Tables<"alunos">;

function baseAquecimento() {
  return {
    LIB: [
      { exercicio: "Rolinho - Panturrilha", repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
      { exercicio: "Rolinho - Anterior, Posterior, Vasto Lateral", repeticoes: '60"', dias: ["T1","T2","T3","T4"] },
      { exercicio: "Rolinho - Quadril (Glúteos)", repeticoes: '60"', dias: ["T1","T3"] },
    ],
    MOB: [
      { exercicio: "Gatinho", repeticoes: "15", dias: ["T1","T2","T3","T4"] },
      { exercicio: "Hip Hinge c/ Mãos na Parede", repeticoes: "15", dias: ["T2","T4"] },
      { exercicio: "Dorsiflexão passiva (na parede)", repeticoes: "15", dias: ["T1","T3"] },
    ],
    ATI: [
      { exercicio: "Prancha Frontal", repeticoes: '20"', dias: ["T1","T2","T3","T4"] },
      { exercicio: "Ponte Bilateral", repeticoes: '20"', dias: ["T2","T4"] },
      { exercicio: "Ativação glúteo c/ band no joelho", repeticoes: "20", dias: ["T1","T3"] },
    ],
  } as PersonalizadoConteudo["aquecimento"];
}

function makeSimples(): PersonalizadoConteudo {
  return {
    aquecimento: baseAquecimento(),
    observacoes: "",
    treinos: [1,2,3,4].map((n) => ({
      nome: `TREINO ${n}`,
      blocos: [
        { nome: "Bloco A", exercicios: [
          { tipo: "simples", categoria: "DJS", exercicio: `T${n}-A1 Agachamento Kettlebell`, series: 3, repeticoes: "10" },
          { tipo: "simples", categoria: "PH",  exercicio: `T${n}-A2 Remada Cabo Unilateral`, series: 3, repeticoes: "10" },
        ]},
        { nome: "Bloco B", exercicios: [
          { tipo: "simples", categoria: "EP", exercicio: `T${n}-B3 Flexão Joelhos na Bola`, series: 3, repeticoes: "10" },
          { tipo: "simples", categoria: "EV", exercicio: `T${n}-B4 Press Mina Terrestre`, series: 3, repeticoes: "10" },
          { tipo: "simples", categoria: "AH", exercicio: `T${n}-B5 Dead Bug Alternado`, series: 3, repeticoes: "20" },
        ]},
      ],
    })),
  };
}

function makeImparPar(): PersonalizadoConteudo {
  const c = makeSimples();
  c.treinos.forEach((tr) => {
    tr.blocos.forEach((bl) => {
      bl.exercicios = bl.exercicios.map((ex: any) => ({
        tipo: "dinamico",
        categoria: ex.categoria,
        rotacao: "impar_par",
        series_modo: "compartilhado",
        series: ex.series,
        repeticoes: ex.repeticoes,
        variantes: [
          { exercicio: ex.exercicio + " (X)" },
          { exercicio: ex.exercicio.replace(/A1|A2|B3|B4|B5/, "alt") + " (Y)" },
        ],
      }));
    });
  });
  return c;
}

function makeRotativa(): PersonalizadoConteudo {
  const c = makeSimples();
  c.treinos.forEach((tr) => {
    tr.blocos.forEach((bl) => {
      bl.exercicios = bl.exercicios.map((ex: any) => ({
        tipo: "dinamico",
        categoria: ex.categoria,
        rotacao: "rotativa",
        series_modo: "independente",
        series: ex.series,
        repeticoes: ex.repeticoes,
        variantes: [
          { exercicio: ex.exercicio + " A", series: 3, repeticoes: "10" },
          { exercicio: ex.exercicio.replace(/A1|A2|B3|B4|B5/, "alt") + " B", series: 4, repeticoes: "8" },
          { exercicio: ex.exercicio.replace(/A1|A2|B3|B4|B5/, "alt2") + " C", series: 3, repeticoes: "12" },
        ],
      }));
    });
  });
  return c;
}

async function gen(name: string, conteudo: PersonalizadoConteudo) {
  const flat = flattenPersonalizado(conteudo);
  const doc: any = await exportWorkoutPDF({
    student, descricao: "PERSONALIZADO", data: flat, returnDoc: true, weeks: 4,
  });
  const buf = Buffer.from(doc.output("arraybuffer"));
  writeFileSync(`/tmp/personalizado_${name}.pdf`, buf);
  // eslint-disable-next-line no-console
  console.log(`${name}: pages=${doc.getNumberOfPages()}, size=${buf.length}`);
}

describe.skip("manual: gen personalizado pdfs", () => {
  it("ok", () => {});
});

describe("gen personalizado pdfs", () => {
  it("simples", async () => { await gen("simples", makeSimples()); });
  it("impar_par", async () => { await gen("impar_par", makeImparPar()); });
  it("rotativa", async () => { await gen("rotativa", makeRotativa()); });
});
