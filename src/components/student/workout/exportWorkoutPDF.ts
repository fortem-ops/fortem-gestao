import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
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
  /** URL encoded into the header QR Code (opens the workout in the app). */
  qrUrl?: string;
}

// Palette: red accent + grayscale (prints clean in B&W).
const INK: [number, number, number] = [24, 24, 27];          // zinc-900 — primary text
const INK_SOFT: [number, number, number] = [82, 82, 91];     // zinc-600 — secondary text
const INK_MUTED: [number, number, number] = [161, 161, 170]; // zinc-400 — captions
const RULE: [number, number, number] = [228, 228, 231];      // zinc-200 — dividers
const SURFACE: [number, number, number] = [244, 244, 245];   // zinc-100 — section bands
const WHITE: [number, number, number] = [255, 255, 255];

// Red family — the single brand accent.
const RED: [number, number, number] = [185, 28, 28];         // red-700 — primary accent
const RED_SOFT: [number, number, number] = [220, 38, 38];    // red-600 — text accent
const RED_TINT: [number, number, number] = [254, 226, 226];  // red-100 — soft band

// Warm-up block accents (Red, Black/Ink, Gray) — keeps the brand palette.
const WARMUP_COLORS: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
  LIB: { fill: RED, text: WHITE },          // Liberação — RED
  MOB: { fill: INK, text: WHITE },          // Mobilidade — BLACK
  ATI: { fill: INK_MUTED, text: INK },      // Ativação — GRAY
};

const DAYS = ["T1", "T2", "T3", "T4"] as const;
const CHECK = "v"; // check mark glyph that prints reliably in Helvetica

/**
 * Generates a single-page A4 portrait PDF with a modern, minimal layout.
 * Includes: header w/ QR Code, warm-up blocks (LIB/MOB/ATI in distinct colors),
 * strength sessions split into Bloco A (ex 1-2) and Bloco B (ex 3-5),
 * a Frequência column, and a manual Observações area.
 */
export async function exportWorkoutPDF({ student, descricao, data, print, weeks = 4, qrUrl }: ExportArgs) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297

  // ---------- Layout grid ----------
  const margin = 10;
  const gutter = 4;
  const freqColW = 22;
  const mainW = pageW - margin * 2 - freqColW - gutter;
  const mainX = margin;
  const freqX = mainX + mainW + gutter;

  // ============================================================
  // HEADER — wordmark + student identity + QR code
  // ============================================================
  const headerH = 20;
  const qrSize = 16;

  // Wordmark (red accent on the F)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...RED);
  doc.text("F", mainX, margin + 7);
  const fW = doc.getTextWidth("F");
  doc.setTextColor(...INK);
  doc.text("ORTEM", mainX + fW, margin + 7);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...INK_MUTED);
  doc.text("TREINAMENTO  ·  PLANILHA TÉCNICA", mainX, margin + 11);

  // QR Code (centered in header)
  if (qrUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        margin: 0,
        width: 256,
        color: { dark: "#18181b", light: "#ffffff" },
      });
      const qrX = mainX + mainW / 2 - qrSize / 2;
      const qrY = margin - 1;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(...INK_MUTED);
      doc.text("VÍDEOS NO APP", qrX + qrSize / 2, qrY + qrSize + 2, { align: "center" });
    } catch {
      // silent fail — QR is decorative
    }
  }

  // Right-aligned: student block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text("ALUNO", mainX + mainW, margin + 4, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(student.nome.toUpperCase(), mainX + mainW, margin + 9, { align: "right" });

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_SOFT);
  doc.text(`${(descricao || "PLANILHA DE TREINO").toUpperCase()}  ·  ${today}`, mainX + mainW, margin + 14, { align: "right" });

  // Red hairline rule under header
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(mainX, margin + headerH, mainX + mainW, margin + headerH);

  let y = margin + headerH + 4;

  // ============================================================
  // SINGLE-PAGE BUDGET
  // We must fit: aquecimento (3 sub-blocks) + 4 strength sessions
  // (each with Bloco A + Bloco B) + a small Observações area + footer.
  // Compute a vertical scale so the whole content fits on one A4 page.
  // ============================================================
  const footerReserve = 6;
  const obsMinH = 14;          // minimum manual writing area
  const sectionGap = 1.2;      // gap between sub-blocks
  const treinoGap = 1;         // gap after each Treino group
  const obsTopGap = 2;

  // Available vertical space for the body (between header and footer/obs).
  const bodyTop = y;
  const bodyBottom = pageH - margin - footerReserve - obsMinH - obsTopGap;
  const availH = bodyBottom - bodyTop;

  // ---- Estimate raw heights at "nominal" cell padding to derive a scale ----
  const aqBlocosCount = (["LIB", "MOB", "ATI"] as const).filter(
    (k) => data.aquecimento.some((ex) => ex.categoria === k),
  ).length;
  const aqRowsTotal = data.aquecimento.length;

  let forcaRowsTotal = 0;
  let forcaBlocosTotal = 0;
  data.treinos.forEach((tr) => {
    const a = tr.exercicios.slice(0, 2).length;
    const b = tr.exercicios.slice(2, 5).length;
    if (a > 0) { forcaRowsTotal += a; forcaBlocosTotal++; }
    if (b > 0) { forcaRowsTotal += b; forcaBlocosTotal++; }
  });

  // Nominal per-row + per-header costs (mm) — must match autoTable styles below.
  const NOM_ROW = 4.0;          // ~ fontSize 7.2 + padding 1.1*2
  const NOM_HEAD = 4.4;
  const NOM_BADGE = 4.2 + 0.8;  // sub-block badge + gap
  const NOM_TREINO_BAR = 5.8 + 1;
  const NOM_AQ_LABEL = 8;       // section label height (Aquecimento)

  const aqEst = (aqBlocosCount > 0 ? NOM_AQ_LABEL : 0)
    + aqBlocosCount * (NOM_BADGE + NOM_HEAD + sectionGap)
    + aqRowsTotal * NOM_ROW
    + (aqBlocosCount > 0 ? 1.5 : 0);
  const forcaEst = data.treinos.length * NOM_TREINO_BAR
    + forcaBlocosTotal * (NOM_BADGE + NOM_HEAD)
    + forcaRowsTotal * NOM_ROW
    + data.treinos.length * treinoGap;
  const totalEst = aqEst + forcaEst;

  // Scale ≤ 1 — only shrinks (never enlarges) to keep the layout balanced.
  const scale = Math.max(0.62, Math.min(1, availH / Math.max(totalEst, 1)));

  // Scaled style values (used by every section/table below).
  const ROW_FONT = Math.max(5.6, 7.2 * scale);
  const HEAD_FONT = Math.max(5.0, 6.0 * scale);
  const ROW_PAD = Math.max(0.45, 1.1 * scale);
  const HEAD_PAD = Math.max(0.5, 1.2 * scale);
  const BADGE_H = Math.max(3.2, 4.2 * scale);
  const BAR_H = Math.max(4.6, 5.8 * scale);
  const TREINO_LABEL_FONT = Math.max(6.5, 8 * scale);

  // ============================================================
  // Helper — section label
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
  // AQUECIMENTO — separated by LIB / MOB / ATI sub-blocks
  // ============================================================
  if (data.aquecimento.length > 0) {
    sectionLabel("Aquecimento", "Liberação · Mobilidade · Ativação");

    const blocos: { key: "LIB" | "MOB" | "ATI"; label: string; items: WorkoutExercise[] }[] = [
      { key: "LIB", label: "LIBERAÇÃO", items: [] },
      { key: "MOB", label: "MOBILIDADE", items: [] },
      { key: "ATI", label: "ATIVAÇÃO", items: [] },
    ];
    data.aquecimento.forEach(ex => {
      const b = blocos.find(b => b.key === ex.categoria);
      if (b) b.items.push(ex);
    });

    blocos.filter(b => b.items.length > 0).forEach(bloco => {
      const colors = WARMUP_COLORS[bloco.key];

      // Sub-block badge + label
      const badgeW = 14;
      doc.setFillColor(...colors.fill);
      doc.rect(mainX, y, badgeW, BADGE_H, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(5.5, 6.5 * scale));
      doc.setTextColor(...colors.text);
      doc.text(bloco.key, mainX + badgeW / 2, y + BADGE_H / 2 + 1, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(6, 7 * scale));
      doc.setTextColor(...colors.fill);
      doc.text(bloco.label, mainX + badgeW + 2, y + BADGE_H / 2 + 1);

      y += BADGE_H + 0.6;

      autoTable(doc, {
        startY: y,
        margin: { left: mainX, right: pageW - (mainX + mainW) },
        tableWidth: mainW,
        theme: "plain",
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        head: [[
          { content: "#", styles: { halign: "center" } },
          { content: "EXERCÍCIO", styles: { halign: "left" } },
          { content: "T1", styles: { halign: "center" } },
          { content: "T2", styles: { halign: "center" } },
          { content: "T3", styles: { halign: "center" } },
          { content: "T4", styles: { halign: "center" } },
          { content: "REP", styles: { halign: "right" } },
        ]],
        body: bloco.items.map((ex, i) => [
          String(i + 1),
          ex.exercicio,
          ex.dias?.includes("T1") ? CHECK : "",
          ex.dias?.includes("T2") ? CHECK : "",
          ex.dias?.includes("T3") ? CHECK : "",
          ex.dias?.includes("T4") ? CHECK : "",
          String(ex.repeticoes ?? ""),
        ]),
        styles: {
          fontSize: ROW_FONT,
          cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: 1.5, right: 1.5 },
          textColor: INK,
          lineColor: RULE,
          lineWidth: 0,
        },
        headStyles: {
          fillColor: WHITE,
          textColor: INK_MUTED,
          fontStyle: "bold",
          fontSize: HEAD_FONT,
          cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: 1.5, right: 1.5 },
          lineWidth: { bottom: 0.3 },
          lineColor: colors.fill,
        },
        alternateRowStyles: { fillColor: SURFACE },
        columnStyles: {
          0: { cellWidth: 6, halign: "center", textColor: INK_MUTED, fontSize: Math.max(5.2, 6.5 * scale) },
          1: { cellWidth: "auto" },
          2: { cellWidth: 7, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
          3: { cellWidth: 7, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
          4: { cellWidth: 7, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
          5: { cellWidth: 7, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
          6: { cellWidth: 14, halign: "right", textColor: INK_SOFT },
        },
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            hookData.cell.styles.lineWidth = { bottom: 0.1 } as unknown as number;
            hookData.cell.styles.lineColor = RULE;
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + sectionGap;
    });

    y += 0.8;
  }

  // ============================================================
  // TREINOS — split into Bloco A (ex 1-2) and Bloco B (ex 3-5)
  // ============================================================
  const renderForcaBlock = (
    label: "A" | "B",
    items: WorkoutExercise[],
    startNum: number,
  ) => {
    if (items.length === 0) return;

    // Bloco badge — GRAY (subordinate to the red Treino bar above)
    const badgeW = 16;
    doc.setFillColor(...INK_SOFT);
    doc.rect(mainX, y, badgeW, BADGE_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5.5, 6.5 * scale));
    doc.setTextColor(...WHITE);
    doc.text(`BLOCO ${label}`, mainX + badgeW / 2, y + BADGE_H / 2 + 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5, 6 * scale));
    doc.setTextColor(...INK_MUTED);
    doc.text(label === "A" ? "(2 exercícios)" : "(3 exercícios)", mainX + badgeW + 2, y + BADGE_H / 2 + 1);
    y += BADGE_H + 0.5;

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      head: [[
        { content: "#", styles: { halign: "center" } },
        { content: "CAT", styles: { halign: "left" } },
        { content: "EXERCÍCIO", styles: { halign: "left" } },
        { content: "SÉRIES", styles: { halign: "center" } },
        { content: "REP", styles: { halign: "center" } },
        { content: "KG", styles: { halign: "center" } },
      ]],
      body: items.map((ex, i) => [
        String(startNum + i),
        ex.categoria ?? "",
        ex.exercicio,
        String(ex.series ?? ""),
        String(ex.repeticoes ?? ""),
        ex.kg ?? "",
      ]),
      styles: {
        fontSize: ROW_FONT,
        cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: 1.5, right: 1.5 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: WHITE,
        textColor: INK_MUTED,
        fontStyle: "bold",
        fontSize: HEAD_FONT,
        cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: 1.5, right: 1.5 },
        lineWidth: { bottom: 0.3 },
        lineColor: INK_SOFT,
      },
      columnStyles: {
        0: { cellWidth: 6, halign: "center", textColor: INK_SOFT, fontStyle: "bold" },
        1: { cellWidth: 12, fontStyle: "bold", textColor: INK_SOFT, fontSize: Math.max(5.2, 6.5 * scale) },
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
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.5;
  };

  data.treinos.forEach((tr, idx) => {
    // Section bar — RED background with white label (highlights the Treino)
    doc.setFillColor(...RED);
    doc.rect(mainX, y, mainW, BAR_H, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TREINO_LABEL_FONT);
    doc.setTextColor(...WHITE);
    doc.text((tr.nome || `TREINO ${idx + 1}`).toUpperCase(), mainX + 2.5, y + BAR_H / 2 + 1.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5.8, 6.8 * scale));
    doc.setTextColor(...WHITE);
    doc.text("FORÇA", mainX + mainW - 2, y + BAR_H / 2 + 1.2, { align: "right" });
    y += BAR_H + 0.8;

    const blocoA = tr.exercicios.slice(0, 2);
    const blocoB = tr.exercicios.slice(2, 5);
    renderForcaBlock("A", blocoA, 1);
    renderForcaBlock("B", blocoB, 1);
    y += treinoGap;
  });

  // ============================================================
  // OBSERVAÇÕES — manual write area (fills remaining vertical space)
  // ============================================================
  const obsTitleH = 4;
  const obsBottom = pageH - margin - footerReserve;
  const obsTop = y + obsTopGap;

  if (obsBottom - obsTop > 12) {
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text("OBSERVAÇÕES", mainX, obsTop + 2.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...INK_MUTED);
    doc.text("(anotações manuais)", mainX + 24, obsTop + 2.5);

    // Red hairline under title
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.3);
    doc.line(mainX, obsTop + obsTitleH, mainX + mainW, obsTop + obsTitleH);

    // Soft writing lines
    const linesTop = obsTop + obsTitleH + 2;
    const linesBottom = obsBottom;
    const lineGap = 4.5;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    for (let ly = linesTop + lineGap; ly <= linesBottom; ly += lineGap) {
      doc.line(mainX, ly, mainX + mainW, ly);
    }
  }

  // ============================================================
  // FREQUÊNCIA — vertical column, T1..T4 slots
  // ============================================================
  const freqTopY = margin;
  const freqBottomY = pageH - margin - footerReserve;
  const safeWeeks = Math.max(1, Math.min(12, Math.floor(weeks)));
  const slotCount = safeWeeks * 4;

  // Column header (red)
  const freqHeaderH = 10;
  doc.setFillColor(...RED);
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

  for (let i = 0; i < slotCount; i++) {
    const sy = slotsTop + i * slotH;
    const week = Math.floor(i / 4) + 1;
    const tNum = (i % 4) + 1;

    // Soft alternating background per week
    if (week % 2 === 0) {
      doc.setFillColor(...RED_TINT);
      doc.rect(freqX, sy, freqColW, slotH, "F");
    }

    // Cell border
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.rect(freqX, sy, freqColW, slotH);

    // Week badge on first T of each week
    if (tNum === 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...RED);
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
