import { exportPlanStrongPDF } from "@/components/student/workout/exportPlanStrongPDF";
import { emptyPlanStrong50, emptyLevantamento } from "@/lib/planStrong";
const data = emptyPlanStrong50(3);
data.levantamentos = [emptyLevantamento("agachamento",3), emptyLevantamento("supino",3)];
data.levantamentos.forEach(l=>{l.rm1 = l.tipo==="supino"?100:160; l.diasTreino=["Seg","Qui"];});
data.aquecimento.MOB = [{exercicio:"1 - Mobilidade de Quadril", repeticoes:"10", dias:["Agachamento"], subcategoria:"QUADRIL"} as never];
(globalThis as never as {window:unknown}).window = undefined as never;
const student = { id:"x", nome:"Teste Aluno" } as never;
await exportPlanStrongPDF({ student, data });
