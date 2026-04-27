import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import type { WorkoutExercise } from "./workoutTemplates";
import fortemLogo from "@/assets/fortem-logo-pdf.png";

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
  /** When true, skips the save/print step and returns the jsPDF instance for inspection (used by tests). */
  returnDoc?: boolean;
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
const CHECK = "•DOT•"; // sentinel — replaced by a red dot in didDrawCell

/**
 * Generates a single-page A4 portrait PDF with a modern, minimal layout.
 * Includes: header w/ QR Code, warm-up blocks (LIB/MOB/ATI in distinct colors),
 * strength sessions split into Bloco A (ex 1-2) and Bloco B (ex 3-5),
 * a Frequência column, and a manual Observações area.
 */
export async function exportWorkoutPDF({ student, descricao, data, print, weeks = 4, qrUrl: _qrUrl, returnDoc }: ExportArgs): Promise<jsPDF | void> {
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

  let y = margin + headerH + 3;

  // ============================================================
  // OBSERVAÇÕES — fixed 5-line manual write area (TOP of page)
  // Rendered between the student header and the warm-up section.
  // ============================================================
  const OBS_LINE_GAP = 5;
  const OBS_LINES = 5;
  const obsTitleH = 4;
  const obsBlockH = obsTitleH + 2 + OBS_LINE_GAP * OBS_LINES; // ~31mm
  const obsBottomGap = 2;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  doc.text("OBSERVAÇÕES", mainX, y + 2.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...INK_MUTED);
  doc.text("(anotações manuais)", mainX + 24, y + 2.5);

  // Red hairline under title
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.3);
  doc.line(mainX, y + obsTitleH, mainX + mainW, y + obsTitleH);

  // Exactly 5 evenly-spaced writing lines
  const obsLinesTop = y + obsTitleH + 2;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);
  for (let i = 1; i <= OBS_LINES; i++) {
    const ly = obsLinesTop + i * OBS_LINE_GAP;
    doc.line(mainX, ly, mainX + mainW, ly);
  }

  y += obsBlockH + obsBottomGap;

  // ============================================================
  // SINGLE-PAGE BUDGET
  // Fit aquecimento + frequência + 4 treinos on a single A4 page.
  // Use a conservative estimate plus a safety reserve so autoTable
  // does not push any block to a second page.
  // ============================================================
  const footerReserve = 5;
  const sectionGap = 0.8;
  const treinoGap = 0.6;

  const bodyTop = y;
  const bodyBottom = pageH - margin - footerReserve;
  const availH = bodyBottom - bodyTop;

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

  // Conservative nominal heights — intentionally a bit higher than the
  // actual table metrics to leave room for long exercise names.
  const NOM_ROW = 7.2;
  const NOM_HEAD = 6.2;
  const NOM_BADGE = 6.0;
  const NOM_TREINO_BAR = 7.2;
  const NOM_AQ_LABEL = 9;

  const aqEst = (aqBlocosCount > 0 ? NOM_AQ_LABEL : 0)
    + aqBlocosCount * (NOM_BADGE + NOM_HEAD + sectionGap)
    + aqRowsTotal * NOM_ROW
    + (aqBlocosCount > 0 ? 1 : 0);
  const forcaEst = data.treinos.length * NOM_TREINO_BAR
    + forcaBlocosTotal * NOM_HEAD
    + forcaRowsTotal * NOM_ROW
    + data.treinos.length * treinoGap;
  const totalEst = aqEst + forcaEst + 14;

  // Two-pass scale: never trust an optimistic estimate alone — also compute
  // a floor-based estimate using the minimum row/head heights the layout
  // will actually clamp to. Whichever is smaller wins, preventing the
  // historical bug where Treino 4 / Bloco B was clipped off page 1.
  const FLOOR_ROW = 4.6;
  const FLOOR_HEAD = 3.8;
  const FLOOR_BADGE = 2.6;
  const FLOOR_BAR = 3.8;
  const FLOOR_AQ_LABEL = 5;
  const floorEst = (aqBlocosCount > 0 ? FLOOR_AQ_LABEL : 0)
    + aqBlocosCount * (FLOOR_BADGE + FLOOR_HEAD + sectionGap)
    + aqRowsTotal * FLOOR_ROW
    + data.treinos.length * FLOOR_BAR
    + forcaBlocosTotal * FLOOR_HEAD
    + forcaRowsTotal * FLOOR_ROW
    + data.treinos.length * treinoGap
    + 6; // global slack

  const optimisticScale = availH / Math.max(totalEst, 1);
  const floorScale = availH / Math.max(floorEst, 1);
  const scale = Math.max(0.22, Math.min(1.6, optimisticScale, floorScale));

  const ROW_FONT = Math.max(6.4, 9.5 * scale);
  const HEAD_FONT = Math.max(5.4, 7.2 * scale);
  const ROW_PAD = Math.max(0.4, 1.3 * scale);
  const HEAD_PAD = Math.max(0.35, 1.1 * scale);
  const SIDE_PAD = Math.max(0.5, 1.1 * scale);
  const BADGE_H = Math.max(2.4, 3.8 * scale);
  const BAR_H = Math.max(3.6, 5.1 * scale);
  const TREINO_LABEL_FONT = Math.max(5.4, 7.2 * scale);
  const SECTION_FONT = Math.max(6.0, 7.8 * scale);
  const META_FONT = Math.max(5.0, 6.5 * scale);
  const BADGE_FONT = Math.max(4.6, 5.9 * scale);
  const SMALL_FONT = Math.max(4.4, 5.4 * scale);
  const bodyTextStyles = {
    textColor: INK,
    lineColor: RULE,
    lineWidth: 0,
    overflow: "ellipsize" as const,
    minCellHeight: 0,
  };

  // ============================================================
  // Helper — section label
  // ============================================================
  const sectionLabel = (label: string, meta?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(SECTION_FONT);
    doc.setTextColor(...INK);
    doc.text(label.toUpperCase(), mainX, y);
    if (meta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(META_FONT);
      doc.setTextColor(...INK_MUTED);
      doc.text(meta, mainX + mainW, y, { align: "right" });
    }
    y += 1.1;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.18);
    doc.line(mainX, y, mainX + mainW, y);
    y += 1.1;
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
      const badgeW = 12;
      doc.setFillColor(...colors.fill);
      doc.rect(mainX, y, badgeW, BADGE_H, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(BADGE_FONT);
      doc.setTextColor(...colors.text);
      doc.text(bloco.key, mainX + badgeW / 2, y + BADGE_H / 2 + 0.9, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(5.1, 6.2 * scale));
      doc.setTextColor(...colors.fill);
      doc.text(bloco.label, mainX + badgeW + 1.6, y + BADGE_H / 2 + 0.9);

      y += BADGE_H + 0.4;

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
          ...bodyTextStyles,
          fontSize: ROW_FONT,
          cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: SIDE_PAD, right: SIDE_PAD },
        },
        headStyles: {
          fillColor: WHITE,
          textColor: INK_MUTED,
          fontStyle: "bold",
          fontSize: HEAD_FONT,
          cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: SIDE_PAD, right: SIDE_PAD },
          lineWidth: { bottom: 0.26 },
          lineColor: colors.fill,
        },
        alternateRowStyles: { fillColor: SURFACE },
        columnStyles: (() => {
          const wNum = 6, wT = 7, wRep = 14;
          const wEx = mainW - (wNum + wT * 4 + wRep);
          return {
            0: { cellWidth: wNum, halign: "center", textColor: INK_MUTED, fontSize: SMALL_FONT },
            1: { cellWidth: wEx, overflow: "ellipsize" },
            2: { cellWidth: wT, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
            3: { cellWidth: wT, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
            4: { cellWidth: wT, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
            5: { cellWidth: wT, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
            6: { cellWidth: wRep, halign: "right", textColor: INK_SOFT },
          };
        })(),
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            hookData.cell.styles.lineWidth = { bottom: 0.08 } as unknown as number;
            hookData.cell.styles.lineColor = RULE;
            // T1..T4 columns: hide the sentinel text; the dot is drawn in didDrawCell.
            if (hookData.column.index >= 2 && hookData.column.index <= 5) {
              if (hookData.cell.text?.[0] === CHECK) {
                hookData.cell.text = [""];
              }
            }
          }
        },
        didDrawCell: (hookData) => {
          if (
            hookData.section === "body" &&
            hookData.column.index >= 2 &&
            hookData.column.index <= 5
          ) {
            const ex = bloco.items[hookData.row.index];
            const tKey = (`T${hookData.column.index - 1}`) as "T1" | "T2" | "T3" | "T4";
            if (ex?.dias?.includes(tKey)) {
              const cx = hookData.cell.x + hookData.cell.width / 2;
              const cy = hookData.cell.y + hookData.cell.height / 2;
              const r = Math.max(0.7, Math.min(1.3, ROW_FONT * 0.13));
              doc.setFillColor(...RED_SOFT);
              doc.circle(cx, cy, r, "F");
            }
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + sectionGap;
    });

    y += 0.4;
  }

  // ============================================================
  // TREINOS — split into Bloco A (ex 1-2) and Bloco B (ex 3-5)
  // ============================================================
  const renderForcaBlock = (
    _label: "A" | "B",
    items: WorkoutExercise[],
    _startNum: number,
  ) => {
    if (items.length === 0) return;

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      head: [[
        { content: "CAT", styles: { halign: "left" } },
        { content: "", styles: { halign: "left" } },
        { content: "SÉRIES", styles: { halign: "center" } },
        { content: "REP", styles: { halign: "center" } },
        { content: "KG", styles: { halign: "center" } },
      ]],
      body: items.map((ex) => [
        ex.categoria ?? "",
        ex.exercicio,
        String(ex.series ?? ""),
        String(ex.repeticoes ?? ""),
        ex.kg ?? "",
      ]),
      styles: {
        ...bodyTextStyles,
        fontSize: ROW_FONT,
        cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: SIDE_PAD, right: SIDE_PAD },
      },
      headStyles: {
        fillColor: WHITE,
        textColor: INK_MUTED,
        fontStyle: "bold",
        fontSize: HEAD_FONT,
        cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: SIDE_PAD, right: SIDE_PAD },
        lineWidth: { bottom: 0.26 },
        lineColor: INK_SOFT,
      },
      columnStyles: (() => {
        const wCat = 11, wSer = 16, wRep = 14, wKg = 14;
        const wEx = mainW - (wCat + wSer + wRep + wKg);
        return {
          0: { cellWidth: wCat, fontStyle: "bold", textColor: INK_SOFT, fontSize: SMALL_FONT },
          1: { cellWidth: wEx, overflow: "ellipsize" },
          2: { cellWidth: wSer, halign: "center" },
          3: { cellWidth: wRep, halign: "center" },
          4: { cellWidth: wKg, halign: "center", textColor: INK_SOFT },
        };
      })(),
      didParseCell: (hookData) => {
        if (hookData.section === "body") {
          hookData.cell.styles.lineWidth = { bottom: 0.08 } as unknown as number;
          hookData.cell.styles.lineColor = RULE;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 0.8;
  };

  // ============================================================
  // FREQUÊNCIA — drawn BEFORE strength tables so it lives on page 1
  // even if autoTable temporarily creates a spillover page.
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

    if (week % 2 === 0) {
      doc.setFillColor(...RED_TINT);
      doc.rect(freqX, sy, freqColW, slotH, "F");
    }

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.rect(freqX, sy, freqColW, slotH);

    if (tNum === 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...RED);
      doc.text(`SEM ${week}`, freqX + freqColW - 1.5, sy + 2.2, { align: "right" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(`T${tNum}`, freqX + 2, sy + slotH / 2 + 1.2);

    doc.setDrawColor(...INK_MUTED);
    doc.setLineWidth(0.1);
    const lineY = sy + slotH - 1.5;
    doc.line(freqX + 7, lineY, freqX + freqColW - 1.5, lineY);
  }

  data.treinos.forEach((tr, idx) => {
    doc.setFillColor(...RED);
    doc.rect(mainX, y, mainW, BAR_H, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TREINO_LABEL_FONT);
    doc.setTextColor(...WHITE);
    doc.text((tr.nome || `TREINO ${idx + 1}`).toUpperCase(), mainX + 2.2, y + BAR_H / 2 + 0.95);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5.1, 6.0 * scale));
    doc.setTextColor(...WHITE);
    doc.text("FORÇA", mainX + mainW - 1.8, y + BAR_H / 2 + 0.95, { align: "right" });
    y += BAR_H + 0.45;

    const blocoA = tr.exercicios.slice(0, 2);
    const blocoB = tr.exercicios.slice(2, 5);
    renderForcaBlock("A", blocoA, 1);
    renderForcaBlock("B", blocoB, 1);
    y += treinoGap;
  });

  // (Observações já renderizado no topo da página)

  // (Frequência já renderizada antes dos treinos para garantir página única)

  // ============================================================
  // SAFETY — guarantee single page: drop any spillover pages so the
  // final PDF is always a single A4 sheet, no matter what.
  // ============================================================
  const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  if (totalPages > 1) {
    for (let p = totalPages; p > 1; p--) {
      (doc as unknown as { deletePage: (n: number) => void }).deletePage(p);
    }
    (doc as unknown as { setPage: (n: number) => void }).setPage(1);
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

  if (returnDoc) {
    return doc;
  }

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(filename);
  }
}
