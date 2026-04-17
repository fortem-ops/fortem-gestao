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
  /** Number of weeks (T1..T4 cycles) to display in the Frequência column. Default 4 (= 16 slots). */
  weeks?: number;
}

// Modern, restrained palette — grayscale-first, single accent that prints cleanly in B&W.
const INK: [number, number, number] = [24, 24, 27];          // zinc-900 — primary text
const INK_SOFT: [number, number, number] = [82, 82, 91];     // zinc-600 — secondary text
const INK_MUTED: [number, number, number] = [161, 161, 170]; // zinc-400 — captions
const RULE: [number, number, number] = [228, 228, 231];      // zinc-200 — dividers
const SURFACE: [number, number, number] = [244, 244, 245];   // zinc-100 — section bands
const ACCENT: [number, number, number] = [24, 24, 27];       // pure ink for headers (prints clean in B&W)
const WHITE: [number, number, number] = [255, 255, 255];

const DAYS = ["T1", "T2", "T3", "T4"] as const;

/**
 * Generates a single-page A4 portrait PDF with a modern, minimal grid layout.
 * Mantém a mesma lógica estrutural: cabeçalho, aquecimento (LIB/MOB/ATI),
 * blocos de treino (FORÇA) e coluna de FREQUÊNCIA com slots T1..T4.
 */
export function exportWorkoutPDF({ student, descricao, data, print, weeks = 4 }: ExportArgs) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297

  // ---------- Layout grid ----------
  const margin = 10;
  const gutter = 4;
  const freqColW = 24;
  const mainW = pageW - margin * 2 - freqColW - gutter;
  const mainX = margin;
  const freqX = mainX + mainW + gutter;

  // ============================================================
  // HEADER — minimalist wordmark + student identity
  // ============================================================
  const headerH = 18;

  // Wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("FORTEM", mainX, margin + 7);

  // Tagline + thin underline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...INK_MUTED);
  doc.text("TREINAMENTO  ·  PLANILHA TÉCNICA", mainX, margin + 11);

  // Right-aligned: student block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text("ALUNO", mainX + mainW, margin + 4, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(student.nome.toUpperCase(), mainX + mainW, margin + 9, { align: "right" });

  // Date + phase line
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_SOFT);
  doc.text(`${(descricao || "PLANILHA DE TREINO").toUpperCase()}  ·  ${today}`, mainX + mainW, margin + 14, { align: "right" });

  // Hairline rule under header
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(mainX, margin + headerH, mainX + mainW, margin + headerH);

  let y = margin + headerH + 4;

  // ============================================================
  // Helper — section label (small caps, hairline rule)
  // ============================================================
  const sectionLabel = (label: string, meta?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(label.toUpperCase(), mainX, y);
    if (meta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...INK_MUTED);
      doc.text(meta, mainX + mainW, y, { align: "right" });
    }
    y += 1.5;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(mainX, y, mainX + mainW, y);
    y += 1.5;
  };

  // ============================================================
  // AQUECIMENTO
  // ============================================================
  if (data.aquecimento.length > 0) {
    sectionLabel("Aquecimento", "Liberação · Mobilidade · Ativação");

    type Row = { cat: string; nome: string; t: Record<string, boolean>; rep: string };
    const buildRows = (items: WorkoutExercise[]): Row[] =>
      items.map(ex => ({
        cat: ex.categoria ?? "",
        nome: ex.exercicio,
        t: Object.fromEntries(DAYS.map(d => [d, ex.dias?.includes(d) ?? false])),
        rep: String(ex.repeticoes ?? ""),
      }));

    const allRows: Row[] = buildRows(data.aquecimento);
    const MARK = "•"; // bullet renders reliably in Helvetica and reads clean

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      head: [[
        { content: "CAT", styles: { halign: "left" } },
        { content: "EXERCÍCIO", styles: { halign: "left" } },
        { content: "T1", styles: { halign: "center" } },
        { content: "T2", styles: { halign: "center" } },
        { content: "T3", styles: { halign: "center" } },
        { content: "T4", styles: { halign: "center" } },
        { content: "REP", styles: { halign: "right" } },
      ]],
      body: allRows.map(r => [
        r.cat,
        r.nome,
        r.t.T1 ? MARK : "",
        r.t.T2 ? MARK : "",
        r.t.T3 ? MARK : "",
        r.t.T4 ? MARK : "",
        r.rep,
      ]),
      styles: {
        fontSize: 7.2,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: WHITE,
        textColor: INK_MUTED,
        fontStyle: "bold",
        fontSize: 6.2,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
        lineWidth: { bottom: 0.3 },
        lineColor: INK,
      },
      // Subtle zebra stripe — light enough to print well in B&W
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: {
        0: { cellWidth: 11, fontStyle: "bold", textColor: INK_SOFT, fontSize: 6.5 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 7, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 7, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 7, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 7, halign: "center", fontStyle: "bold" },
        6: { cellWidth: 14, halign: "right", textColor: INK_SOFT },
      },
      didParseCell: (hookData) => {
        // Bottom hairline on every body row for a clean spreadsheet feel
        if (hookData.section === "body") {
          hookData.cell.styles.lineWidth = { bottom: 0.1 } as unknown as number;
          hookData.cell.styles.lineColor = RULE;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // ============================================================
  // TREINOS — modular blocks (Treino N · FORÇA)
  // ============================================================
  data.treinos.forEach((tr, idx) => {
    // Section bar — light surface with bold label, no heavy fills
    const barH = 5.5;
    doc.setFillColor(...SURFACE);
    doc.rect(mainX, y, mainW, barH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text((tr.nome || `TREINO ${idx + 1}`).toUpperCase(), mainX + 2, y + barH / 2 + 1.1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK_MUTED);
    doc.text("FORÇA", mainX + mainW - 2, y + barH / 2 + 1.1, { align: "right" });
    y += barH + 0.5;

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      head: [[
        { content: "#", styles: { halign: "center" } },
        { content: "CAT", styles: { halign: "left" } },
        { content: "EXERCÍCIO", styles: { halign: "left" } },
        { content: "SÉRIES", styles: { halign: "center" } },
        { content: "REP", styles: { halign: "center" } },
        { content: "KG", styles: { halign: "center" } },
      ]],
      body: tr.exercicios.map((ex, i) => [
        String(i + 1),
        ex.categoria ?? "",
        ex.exercicio,
        String(ex.series ?? ""),
        String(ex.repeticoes ?? ""),
        ex.kg ?? "",
      ]),
      styles: {
        fontSize: 7.2,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: WHITE,
        textColor: INK_MUTED,
        fontStyle: "bold",
        fontSize: 6.2,
        cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 },
        lineWidth: { bottom: 0.3 },
        lineColor: INK,
      },
      columnStyles: {
        0: { cellWidth: 6, halign: "center", textColor: INK_MUTED },
        1: { cellWidth: 12, fontStyle: "bold", textColor: INK_SOFT, fontSize: 6.5 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 14, halign: "center", textColor: INK_SOFT },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body") {
          hookData.cell.styles.lineWidth = { bottom: 0.1 } as unknown as number;
          hookData.cell.styles.lineColor = RULE;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  });

  // ============================================================
  // FREQUÊNCIA — vertical column, T1..T4 slots
  // ============================================================
  const freqTopY = margin;
  const freqBottomY = pageH - margin - 6; // leave room for footer
  const freqAvailH = freqBottomY - freqTopY;
  const safeWeeks = Math.max(1, Math.min(12, Math.floor(weeks)));
  const slotCount = safeWeeks * 4;

  // Column header
  const freqHeaderH = 10;
  doc.setFillColor(...ACCENT);
  doc.rect(freqX, freqTopY, freqColW, freqHeaderH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FREQUÊNCIA", freqX + freqColW / 2, freqTopY + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.text(`${safeWeeks} ${safeWeeks === 1 ? "SEMANA" : "SEMANAS"}`, freqX + freqColW / 2, freqTopY + 7.6, { align: "center" });

  // Slots
  const slotsTop = freqTopY + freqHeaderH + 1;
  const slotsAvailH = freqBottomY - slotsTop;
  const slotH = slotsAvailH / slotCount;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);

  for (let i = 0; i < slotCount; i++) {
    const sy = slotsTop + i * slotH;
    const week = Math.floor(i / 4) + 1;
    const tNum = (i % 4) + 1;

    // Soft alternating background per week for visual rhythm
    if (week % 2 === 0) {
      doc.setFillColor(...SURFACE);
      doc.rect(freqX, sy, freqColW, slotH, "F");
    }

    // Cell border
    doc.setDrawColor(...RULE);
    doc.rect(freqX, sy, freqColW, slotH);

    // Week badge on first T of each week
    if (tNum === 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...INK_MUTED);
      doc.text(`SEM ${week}`, freqX + freqColW - 1.5, sy + 2.2, { align: "right" });
    }

    // T-label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(`T${tNum}`, freqX + 2, sy + slotH / 2 + 1.2);

    // Signature line
    doc.setDrawColor(...INK_MUTED);
    doc.setLineWidth(0.1);
    const lineY = sy + slotH - 1.5;
    doc.line(freqX + 7, lineY, freqX + freqColW - 1.5, lineY);
  }

  // ============================================================
  // FOOTER
  // ============================================================
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...INK_MUTED);
  doc.text("FORTEM Treinamento — documento gerado automaticamente", margin, pageH - 4);
  doc.text(today, pageW - margin, pageH - 4, { align: "right" });

  // ============================================================
  // OUTPUT
  // ============================================================
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
