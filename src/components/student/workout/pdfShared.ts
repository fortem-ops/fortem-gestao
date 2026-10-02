import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import fortemLogo from "@/assets/fortem-logo-pdf.png";

// Palette compartilhada entre exportadores de treino.
export const INK: [number, number, number] = [24, 24, 27];
export const INK_SOFT: [number, number, number] = [82, 82, 91];
export const INK_MUTED: [number, number, number] = [161, 161, 170];
export const RULE: [number, number, number] = [113, 113, 122];
export const SURFACE: [number, number, number] = [212, 212, 216];
export const WHITE: [number, number, number] = [255, 255, 255];
export const RED: [number, number, number] = [185, 28, 28];
export const RED_SOFT: [number, number, number] = [220, 38, 38];
export const RED_TINT: [number, number, number] = [254, 226, 226];

export const CHECK = "•DOT•";

export const cleanName = (s?: string | null) =>
  (s ?? "").replace(/^\s*\d+\s*[-–—.)]\s*/, "").trim();

/**
 * Cabeçalho compartilhado: logo à esquerda + bloco "ALUNO / nome / subtitle · data" à direita.
 * Retorna o Y logo abaixo da linha vermelha do cabeçalho.
 */
export function drawWorkoutHeader(
  doc: jsPDF,
  student: Tables<"alunos">,
  mainX: number,
  mainW: number,
  margin: number,
  subtitle: string,
): number {
  try {
    const LOGO_H = 8;
    const LOGO_RATIO = 1920 / 357;
    const LOGO_W = LOGO_H * LOGO_RATIO;
    doc.addImage(fortemLogo, "PNG", mainX, margin + 1, LOGO_W, LOGO_H);
  } catch {
    // ignore
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text("ALUNO", mainX + mainW, margin + 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(student.nome.toUpperCase(), mainX + mainW, margin + 9, { align: "right" });

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_SOFT);
  doc.text(`${subtitle}  ·  ${today}`, mainX + mainW, margin + 14, { align: "right" });

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(mainX, margin + 20, mainX + mainW, margin + 20);

  return margin + 20 + 3;
}

/** Barra vermelha de seção com label (obrigatório) e meta opcional à direita. */
export function sectionBar(
  doc: jsPDF,
  label: string,
  meta: string | undefined,
  x: number,
  y: number,
  w: number,
  h = 6.4,
): number {
  doc.setFillColor(...RED);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(label.toUpperCase(), x + 2.4, y + h / 2 + 1.1);
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(meta, x + w - 2, y + h / 2 + 1.1, { align: "right" });
  }
  return y + h + 1.2;
}

/** Bloco "OBSERVAÇÕES" — título + N linhas em branco. Retorna novo Y. */
export function drawObservacoes(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  scale = 1,
  lines = 3,
): number {
  const TITLE_FONT = Math.max(6.4, 8.4 * scale);
  const LINE_GAP = Math.max(3.0, 4.4 * scale);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FONT);
  doc.setTextColor(...INK);
  doc.text("OBSERVAÇÕES", x, y + TITLE_FONT * 0.35);
  let lineY = y + TITLE_FONT * 0.35 + LINE_GAP;
  doc.setDrawColor(...INK_MUTED);
  doc.setLineWidth(0.15);
  for (let i = 0; i < lines; i++) {
    doc.line(x, lineY, x + w, lineY);
    lineY += LINE_GAP;
  }
  return lineY - LINE_GAP + Math.max(1.2, 2.0 * scale);
}

/**
 * Observações da prescrição seguidas de linhas livres para anotações manuais.
 * O texto salvo sempre vem antes das linhas, sem sobreposição.
 */
export function drawPrescriptionObservations(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  text?: string | null,
  scale = 1,
  manualLines = 2,
): number {
  const TITLE_FONT = Math.max(6.4, 8.4 * scale);
  const TEXT_FONT = Math.max(6.2, 7.6 * scale);
  const LINE_GAP = Math.max(3.0, 4.4 * scale);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FONT);
  doc.setTextColor(...INK);
  doc.text("OBSERVAÇÕES", x, y + TITLE_FONT * 0.35);

  let cursorY = y + TITLE_FONT * 0.35 + Math.max(2.8, 3.8 * scale);
  const trimmed = text?.trim();
  if (trimmed) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TEXT_FONT);
    doc.setTextColor(...INK_SOFT);
    const textLines = doc.splitTextToSize(trimmed, w) as string[];
    doc.text(textLines, x, cursorY);
    cursorY += textLines.length * Math.max(2.8, 3.2 * scale) + Math.max(1.2, 1.8 * scale);
  }

  doc.setDrawColor(...INK_MUTED);
  doc.setLineWidth(0.15);
  for (let i = 0; i < manualLines; i++) {
    doc.line(x, cursorY, x + w, cursorY);
    cursorY += LINE_GAP;
  }
  return cursorY + Math.max(0.8, 1.2 * scale);
}

/** Coluna lateral de frequência usada na primeira página dos PDFs de treino. */
export function drawFrequencyColumn(
  doc: jsPDF,
  freqX: number,
  freqColW: number,
  topY: number,
  bottomY: number,
  activeSlots: number,
  weeks = 4,
): void {
  const safeSlots = Math.max(1, Math.floor(activeSlots));
  const safeWeeks = Math.max(1, Math.min(12, Math.floor(weeks)));
  const headerH = 10;

  doc.setFillColor(...RED);
  doc.rect(freqX, topY, freqColW, headerH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FREQUÊNCIA", freqX + freqColW / 2, topY + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.text(`${safeWeeks} ${safeWeeks === 1 ? "SEMANA" : "SEMANAS"}`, freqX + freqColW / 2, topY + 7.6, { align: "center" });

  const slotsTop = topY + headerH + 1;
  const slotCount = safeWeeks * safeSlots;
  const slotH = (bottomY - slotsTop) / slotCount;
  for (let i = 0; i < slotCount; i++) {
    const sy = slotsTop + i * slotH;
    const week = Math.floor(i / safeSlots) + 1;
    const slot = (i % safeSlots) + 1;
    if (week % 2 === 0) {
      doc.setFillColor(...RED_TINT);
      doc.rect(freqX, sy, freqColW, slotH, "F");
    }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.rect(freqX, sy, freqColW, slotH);
    if (slot === 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...RED);
      doc.text(`SEM ${week}`, freqX + freqColW - 1.5, sy + 2.2, { align: "right" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(`T${slot}`, freqX + 2, sy + slotH / 2 + 1.2);
    doc.setDrawColor(...INK_MUTED);
    doc.setLineWidth(0.1);
    doc.line(freqX + 7, sy + slotH - 1.5, freqX + freqColW - 1.5, sy + slotH - 1.5);
  }
}

// ─────────────────────────────────────────────────────────────
// Tabela de força padrão (modelo do Treino Personalizado):
// CAT | EXERCÍCIO | <colunas do método>, lista única por treino.
// Grupos (principais × acessórios) separados só por uma linha
// grossa, sem sub-cabeçalho de texto.
// ─────────────────────────────────────────────────────────────
export interface StrengthCol {
  header: string;
  width: number;
  /** Destaque numérico (negrito, maior). */
  strong?: boolean;
  muted?: boolean;
}
export interface StrengthRow {
  cat: string;
  nome: string;
  cells: string[];
}

export function drawStrengthTable(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    cols: StrengthCol[];
    /** Cada grupo é uma lista de linhas; entre grupos entra a linha grossa. */
    groups: StrengthRow[][];
  },
): number {
  const { x, y, w, cols } = opts;
  const pageW = doc.internal.pageSize.getWidth();
  const groups = opts.groups.filter((g) => g.length > 0);
  const rows: StrengthRow[] = [];
  const groupStart = new Set<number>();
  groups.forEach((g, gi) => {
    if (gi > 0) groupStart.add(rows.length);
    rows.push(...g);
  });

  const ROW_FONT = 7.2;
  const EX_FONT = 8.4;
  const NUM_FONT = 8.4;
  const HEAD_FONT = 6.2;
  const ROW_PAD = 1.0;
  const HEAD_PAD = 0.9;
  const SIDE = 1.0;
  const wCat = 11;
  const wEx = w - wCat - cols.reduce((s, c) => s + c.width, 0);

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: wCat, fontStyle: "bold", textColor: INK_SOFT, fontSize: EX_FONT },
    1: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold", fontSize: EX_FONT },
  };
  cols.forEach((c, i) => {
    columnStyles[i + 2] = {
      cellWidth: c.width,
      halign: "center",
      ...(c.strong ? { fontStyle: "bold", fontSize: NUM_FONT } : {}),
      ...(c.muted ? { textColor: INK_SOFT } : {}),
    };
  });

  autoTable(doc, {
    startY: y,
    margin: { left: x, right: pageW - (x + w) },
    tableWidth: w,
    theme: "plain",
    pageBreak: "avoid",
    rowPageBreak: "avoid",
    head: [[
      { content: "CAT", styles: { halign: "left" as const } },
      { content: "EXERCÍCIO", styles: { halign: "left" as const } },
      ...cols.map((c) => ({ content: c.header, styles: { halign: "center" as const } })),
    ]],
    body: rows.map((r) => [r.cat, r.nome, ...cols.map((_, i) => r.cells[i] ?? "")]),
    styles: {
      font: "helvetica",
      textColor: INK,
      fontSize: ROW_FONT,
      valign: "middle",
      cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: SIDE, right: SIDE },
    },
    headStyles: {
      fillColor: WHITE,
      textColor: INK,
      fontStyle: "bold",
      fontSize: HEAD_FONT,
      cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: SIDE, right: SIDE },
      lineWidth: { bottom: 0.26 } as unknown as number,
      lineColor: INK_SOFT,
    },
    columnStyles,
    didParseCell: (hd) => {
      if (hd.section !== "body") return;
      hd.cell.styles.lineWidth = 0;
      if (groupStart.has(hd.row.index)) {
        hd.cell.styles.cellPadding = { top: ROW_PAD + 1.4, bottom: ROW_PAD, left: SIDE, right: SIDE } as unknown as number;
      }
    },
    didDrawCell: (hd) => {
      if (hd.section !== "body") return;
      const i = hd.row.index;
      const x1 = hd.cell.x;
      const x2 = hd.cell.x + hd.cell.width;
      const isLastOfGroup = i === rows.length - 1 || groupStart.has(i + 1);
      if (!isLastOfGroup) {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.12);
        doc.line(x1, hd.cell.y + hd.cell.height, x2, hd.cell.y + hd.cell.height);
      }
      if (groupStart.has(i)) {
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.5);
        doc.line(x1, hd.cell.y, x2, hd.cell.y);
      }
    },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
