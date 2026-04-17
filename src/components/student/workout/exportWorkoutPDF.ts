import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import type { WorkoutExercise } from "./workoutTemplates";

interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

interface ExportArgs {
  student: Tables<"alunos">;
  descricao: string;
  data: WorkoutData;
  /** If true, opens the print dialog instead of saving the file. */
  print?: boolean;
}

const RED: [number, number, number] = [220, 38, 38];
const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];
const GREY_TEXT: [number, number, number] = [60, 60, 60];

const DAYS = ["T1", "T2", "T3", "T4"] as const;

/**
 * Generates a single-page A4 portrait PDF mirroring the FORTEM training sheet
 * (header + warm-up table with T1..T4 + multiple TREINO blocks + frequência column).
 */
export function exportWorkoutPDF({ student, descricao, data, print }: ExportArgs) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297

  const marginX = 6;
  const freqColW = 22;
  const mainW = pageW - marginX * 2 - freqColW - 2; // gap of 2mm
  const mainX = marginX;
  const freqX = mainX + mainW + 2;

  // ---------- Header ----------
  const headerH = 16;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  // Outer header box
  doc.rect(mainX, marginX, mainW, headerH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("NOME DO ALUNO:", mainX + 3, marginX + 6);
  doc.setFont("helvetica", "normal");
  doc.text(student.nome.toUpperCase(), mainX + 38, marginX + 6);

  // FORTEM logo (text-based to keep things simple and font-safe)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...RED);
  doc.text("FORTEM", mainX + mainW - 3, marginX + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY_TEXT);
  doc.text("TREINAMENTO", mainX + mainW - 3, marginX + 12.5, { align: "right" });

  // Frequência header
  doc.setFillColor(...RED);
  doc.rect(freqX, marginX, freqColW, headerH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FREQUÊNCIA", freqX + freqColW / 2, marginX + headerH / 2 + 1, { align: "center" });

  let y = marginX + headerH;

  // ---------- Title strip (FASE) ----------
  const titleH = 6;
  doc.setFillColor(...RED);
  doc.rect(mainX, y, mainW, titleH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((descricao || "PLANILHA DE TREINO").toUpperCase(), mainX + mainW / 2, y + titleH / 2 + 1.2, { align: "center" });
  y += titleH;

  // ---------- AQUECIMENTO ----------
  const drawSectionBar = (label: string, color: [number, number, number] = BLACK) => {
    const h = 5;
    doc.setFillColor(...color);
    doc.rect(mainX, y, mainW, h, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(label, mainX + mainW / 2, y + h / 2 + 1, { align: "center" });
    y += h;
  };

  if (data.aquecimento.length > 0) {
    drawSectionBar("AQUECIMENTO");

    type Row = { letterCol: string; code: string; nome: string; t: Record<string, boolean>; rep: string; kg: string };
    const lib = data.aquecimento.filter(e => e.categoria === "LIB");
    const mob = data.aquecimento.filter(e => e.categoria === "MOB");
    const ati = data.aquecimento.filter(e => e.categoria === "ATI");

    const buildRows = (items: WorkoutExercise[], letters: string[]): Row[] =>
      items.map((ex, idx) => ({
        letterCol: letters[idx] ?? "",
        code: codeFor(ex),
        nome: ex.exercicio,
        t: Object.fromEntries(DAYS.map(d => [d, ex.dias?.includes(d) ?? false])),
        rep: String(ex.repeticoes ?? ""),
        kg: ex.kg ?? "",
      }));

    const allRows: Row[] = [
      ...buildRows(lib, ["L", "I", "B", ""]),
      ...buildRows(mob, ["M", "O", "B", "", ""]),
      ...buildRows(ati, ["A", "T", "I", "", ""]),
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "grid",
      head: [[
        { content: "", styles: { cellWidth: 6 } },
        { content: "", styles: { cellWidth: 22 } },
        { content: "EXERCICIOS", styles: { halign: "center" } },
        { content: "T1", styles: { cellWidth: 6, halign: "center" } },
        { content: "T2", styles: { cellWidth: 6, halign: "center" } },
        { content: "T3", styles: { cellWidth: 6, halign: "center" } },
        { content: "T4", styles: { cellWidth: 6, halign: "center" } },
        { content: "REP.", styles: { cellWidth: 12, halign: "center" } },
        { content: "KG", styles: { cellWidth: 10, halign: "center" } },
      ]],
      body: allRows.map(r => [
        r.letterCol,
        r.code,
        r.nome,
        r.t.T1 ? "✓" : "",
        r.t.T2 ? "✓" : "",
        r.t.T3 ? "✓" : "",
        r.t.T4 ? "✓" : "",
        r.rep,
        r.kg,
      ]),
      styles: { fontSize: 7.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: BLACK },
      headStyles: { fillColor: WHITE, textColor: BLACK, fontStyle: "bold", lineWidth: 0.1, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 6, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 22, fontStyle: "bold", fontSize: 7 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 6, halign: "center", textColor: [22, 163, 74], fontStyle: "bold" },
        4: { cellWidth: 6, halign: "center", textColor: [22, 163, 74], fontStyle: "bold" },
        5: { cellWidth: 6, halign: "center", textColor: [22, 163, 74], fontStyle: "bold" },
        6: { cellWidth: 6, halign: "center", textColor: [22, 163, 74], fontStyle: "bold" },
        7: { cellWidth: 12, halign: "center" },
        8: { cellWidth: 10, halign: "center" },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  // ---------- TREINOS ----------
  data.treinos.forEach((tr, idx) => {
    const titleBarH = 5;
    doc.setFillColor(...BLACK);
    doc.rect(mainX, y, mainW, titleBarH, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text((tr.nome || `TREINO ${idx + 1}`).toUpperCase(), mainX + mainW / 2, y + titleBarH / 2 + 1, { align: "center" });
    y += titleBarH;

    doc.setFillColor(...RED);
    doc.rect(mainX, y, mainW, titleBarH, "F");
    doc.setTextColor(...WHITE);
    doc.text("FORÇA", mainX + mainW / 2, y + titleBarH / 2 + 1, { align: "center" });
    y += titleBarH;

    const blocoA = tr.exercicios.slice(0, 2);
    const blocoB = tr.exercicios.slice(2);
    const rows: (string | number)[][] = [];
    blocoA.forEach((ex, i) => rows.push([i + 1, codeFor(ex), ex.exercicio, String(ex.series ?? ""), String(ex.repeticoes ?? ""), ex.kg ?? ""]));
    if (blocoB.length > 0) {
      rows.push(["", "", "", "", "", ""]);
      blocoB.forEach((ex, i) => rows.push([i + 1, codeFor(ex), ex.exercicio, String(ex.series ?? ""), String(ex.repeticoes ?? ""), ex.kg ?? ""]));
    }

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "grid",
      head: [[
        { content: "", styles: { cellWidth: 6 } },
        { content: "", styles: { cellWidth: 22 } },
        { content: "EXERCICIOS", styles: { halign: "center" } },
        { content: "SERIES", styles: { cellWidth: 16, halign: "center" } },
        { content: "REP.", styles: { cellWidth: 14, halign: "center" } },
        { content: "KG", styles: { cellWidth: 14, halign: "center" } },
      ]],
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: BLACK },
      headStyles: { fillColor: WHITE, textColor: BLACK, fontStyle: "bold", lineWidth: 0.1, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 6, halign: "center" },
        1: { cellWidth: 22, fontStyle: "bold", halign: "center", fontSize: 7 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 14, halign: "center" },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  });

  // ---------- Frequência column ----------
  const freqTopY = marginX + headerH;
  const freqBottomY = pageH - marginX;
  const freqAvailH = freqBottomY - freqTopY;
  const slotCount = 16;
  const slotH = freqAvailH / slotCount;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.2);
  for (let i = 0; i < slotCount; i++) {
    const sy = freqTopY + i * slotH;
    doc.rect(freqX, sy, freqColW, slotH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(`T${(i % 4) + 1}`, freqX + 2, sy + slotH / 2 + 1.2);
  }

  // ---------- Footer ----------
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text("FORTEM Treinamento — documento gerado automaticamente", marginX, pageH - 2);

  const safeName = student.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `treino-${safeName}.pdf`;

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(filename);
  }
}

function codeFor(ex: WorkoutExercise): string {
  return (ex.categoria ?? "").toString();
}
