import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { aquecimentoLabel, ordenarBlocosAquecimento } from "@/lib/aquecimentoBlocos";
import type { Tables } from "@/integrations/supabase/types";
import type { AquecimentoBloco, PersonalizadoAquecimentoEx } from "./personalizadoTypes";
import {
  type PTTPConteudo,
  PTTP_LABEL,
  alvoPTTP,
} from "@/lib/pttp";
import {
  INK,
  INK_SOFT,
  INK_MUTED,
  RULE,
  SURFACE,
  WHITE,
  RED_SOFT,
  CHECK,
  cleanName,
  drawWorkoutHeader,
  sectionBar,
  drawFrequencyColumn,
  drawPrescriptionObservations,
  drawStrengthTable,
  type StrengthCol,
  type StrengthRow,
} from "./pdfShared";

interface ExportArgs {
  student: Tables<"alunos">;
  data: PTTPConteudo;
  print?: boolean;
}

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export async function exportPTTPPDF({ student, data, print }: ExportArgs): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const mainX = margin;
  const gutter = 4;
  const freqColW = 22;
  const mainW = pageW - margin * 2 - freqColW - gutter;
  const freqX = mainX + mainW + gutter;
  const bottomY = pageH - margin;

  const ROW_FONT = 8;
  const HEAD_FONT = 6.8;
  const ROW_PAD = 1.2;
  const HEAD_PAD = 1.0;
  const SIDE_PAD = 1.1;

  const commonStyles = {
    fontSize: ROW_FONT,
    cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: SIDE_PAD, right: SIDE_PAD },
    textColor: INK,
    lineColor: INK,
    lineWidth: 0,
    overflow: "ellipsize" as const,
    minCellHeight: 0,
  };
  const commonHeadStyles = {
    fillColor: WHITE,
    textColor: INK,
    fontStyle: "bold" as const,
    fontSize: HEAD_FONT,
    cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: SIDE_PAD, right: SIDE_PAD },
    lineWidth: { bottom: 0.3 } as unknown as number,
    lineColor: INK,
  };
  const bodyBorders = (hd: CellHookData) => {
    if (hd.section === "body") {
      hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.25, left: 0 } as unknown as number;
      hd.cell.styles.lineColor = INK_SOFT;
    }
  };
  const tableMargin = { left: mainX, right: pageW - (mainX + mainW) };

  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, PTTP_LABEL.toUpperCase());
  drawFrequencyColumn(doc, freqX, freqColW, margin, bottomY, data.frequencia, 4);
  y = drawPrescriptionObservations(doc, mainX, y, mainW, data.observacoes, 1, 2);

  const dias = Array.from({ length: data.frequencia }, (_, i) => `T${i + 1}`);

  const ensurePage = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = margin;
    }
  };

  // ── AQUECIMENTO ─────────────────────────────────────────────
  const aq = data.aquecimento;
  const gruposAtivos: AquecimentoBloco[] = aq
    ? ordenarBlocosAquecimento(Object.keys(aq)).filter((k) => (aq[k]?.length ?? 0) > 0)
    : [];

  if (gruposAtivos.length > 0) {
    y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW, 6.4);

    const nDias = dias.length;
    const wNum = 6.4;
    const wCat = 22;
    const wT = 8;
    const wRep = 14;
    const wCarga = 16;
    const wEx = mainW - (wNum + wCat + wT * nDias + wRep + wCarga);

    const colStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wNum, halign: "center", fontStyle: "bold", textColor: INK_SOFT },
      1: {
        cellWidth: wCat,
        halign: "center",
        fontStyle: "bold",
        textColor: INK_SOFT,
        overflow: "linebreak",
        fontSize: ROW_FONT - 1.2,
      },
      2: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold" },
    };
    for (let i = 0; i < nDias; i++) colStyles[3 + i] = { cellWidth: wT, halign: "center" };
    colStyles[4 + nDias] = { cellWidth: wCarga, halign: "center" };
    colStyles[3 + nDias] = {
      cellWidth: wRep,
      halign: "right",
      fontStyle: "bold",
      textColor: INK_SOFT,
    };

    const head = [[
      { content: "#", styles: { halign: "center" as const } },
      { content: "CAT", styles: { halign: "center" as const } },
      { content: "EXERCÍCIOS", styles: { halign: "left" as const } },
      ...dias.map((d) => ({ content: d, styles: { halign: "center" as const } })),
      { content: "REP.", styles: { halign: "right" as const } },
      { content: "CARGA", styles: { halign: "center" as const } },
    ]];

    gruposAtivos.forEach((g) => {
      const items = aq[g]!;
      const SUBBAR_H = 5.4;
      const badgeW = 12;
      ensurePage(SUBBAR_H + 12);
      doc.setFillColor(...INK);
      doc.rect(mainX, y, badgeW, SUBBAR_H, "F");
      doc.setFillColor(...WHITE);
      doc.rect(mainX + badgeW, y, mainW - badgeW, SUBBAR_H, "F");
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.2);
      doc.line(mainX, y + SUBBAR_H, mainX + mainW, y + SUBBAR_H);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...WHITE);
      doc.text(g, mainX + badgeW / 2, y + SUBBAR_H / 2 + 0.9, { align: "center" });
      doc.setFontSize(7.8);
      doc.setTextColor(...INK);
      doc.text(aquecimentoLabel(g), mainX + badgeW + 2, y + SUBBAR_H / 2 + 0.9);
      y += SUBBAR_H + 0.3;

      const body = items.map((ex: PersonalizadoAquecimentoEx, idx) => {
        const cells: string[] = [
          String(idx + 1),
          (ex.subcategoria || "").toUpperCase(),
          cleanName(ex.exercicio) || "—",
        ];
        dias.forEach((d) => cells.push(ex.dias?.includes(d) ? CHECK : ""));
        cells.push(String(ex.repeticoes ?? ""));
        cells.push("");
        return cells;
      });

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        tableWidth: mainW,
        theme: "plain",
        rowPageBreak: "avoid",
        head,
        body,
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: SURFACE },
        columnStyles: colStyles,
        didParseCell: (hd) => {
          if (hd.section === "body") {
            hd.cell.styles.lineWidth = {
              top: 0,
              right: 0,
              bottom: 0.25,
              left: 0,
            } as unknown as number;
            hd.cell.styles.lineColor = INK_SOFT;
            if (hd.column.index >= 3 && hd.column.index < 3 + nDias) {
              if (hd.cell.text?.[0] === CHECK) hd.cell.text = [""];
            }
          }
        },
        didDrawCell: (hd) => {
          if (hd.section === "body" && hd.column.index >= 3 && hd.column.index < 3 + nDias) {
            const row = items[hd.row.index];
            const diaLabel = dias[hd.column.index - 3];
            if (row?.dias?.includes(diaLabel)) {
              doc.setFillColor(...RED_SOFT);
              doc.circle(
                hd.cell.x + hd.cell.width / 2,
                hd.cell.y + hd.cell.height / 2,
                Math.max(0.7, ROW_FONT * 0.13),
                "F",
              );
            }
            if (hd.column.index > 3) {
              doc.setDrawColor(...RULE);
              doc.setLineWidth(0.12);
              doc.line(hd.cell.x, hd.cell.y + 0.4, hd.cell.x, hd.cell.y + hd.cell.height - 0.4);
            }
          }
        },
      });
      y = lastY(doc) + 0.8;
    });
    y += 1;
  }

  // Página 1 concentra identificação, frequência, observações e aquecimento.
  doc.addPage();
  y = margin;

  // ── PROGRESSÃO DOS LEVANTAMENTOS CENTRAIS ───────────────────
  // As duas tabelas ocupam a página 2 lado a lado e deixam uma área extensa
  // para registros futuros. A legenda fica inteira no rodapé desta página.
  const progressGap = 5;
  const progressW = (mainW - progressGap) / 2;
  const progressXs = [mainX, mainX + progressW + progressGap];
  const progressTop = y;
  const progressRows = 55;
  const progressFinalYs: number[] = [];

  data.levantamentos.forEach((lev, levIndex) => {
    const x = progressXs[levIndex] ?? mainX;
    const alvo = alvoPTTP(lev);
    let tableY = sectionBar(doc, `${lev.levantamento} — progressão`, undefined, x, progressTop, progressW, 6.0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...INK_SOFT);
    doc.text(`PRÓXIMA: ${alvo.esquema} @ ${alvo.peso || "—"} KG`, x, tableY + 2.3);
    tableY += 4.2;

    const linhasHist: string[][] = lev.historico.map((h, i) => [
      `TREINO #${i + 1}`,
      h.data,
      `${h.peso} kg`,
      h.sucesso ? "✓" : "✗",
    ]);
    if (linhasHist.length === 0) {
      linhasHist.push(["TREINO #1", "—", `${alvo.peso || "—"} kg`, ""]);
    }
    const totalRows = Math.max(progressRows, linhasHist.length);
    while (linhasHist.length < totalRows) {
      linhasHist.push([`TREINO #${linhasHist.length + 1}`, "", "", ""]);
    }

    autoTable(doc, {
      startY: tableY,
      margin: { left: x, right: pageW - (x + progressW), bottom: 28 },
      tableWidth: progressW,
      theme: "plain",
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      head: [[
        { content: "SESSÃO", styles: { halign: "left" as const } },
        { content: "DATA", styles: { halign: "left" as const } },
        { content: "PESO", styles: { halign: "center" as const } },
        { content: "RESULTADO", styles: { halign: "center" as const } },
      ]],
      body: linhasHist,
      styles: {
        ...commonStyles,
        fontSize: 6.7,
        cellPadding: { top: 0.9, bottom: 0.9, left: 0.8, right: 0.8 },
      },
      headStyles: {
        ...commonHeadStyles,
        fontSize: 5.8,
        cellPadding: { top: 0.9, bottom: 0.9, left: 0.7, right: 0.7 },
      },
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold", textColor: INK_SOFT },
        1: { cellWidth: 20 },
        2: { cellWidth: 19, halign: "center", fontStyle: "bold" },
        3: { cellWidth: progressW - 63, halign: "center" },
      },
      didParseCell: bodyBorders,
    });
    progressFinalYs.push(lastY(doc));
  });

  const progressBottom = Math.max(...progressFinalYs);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.45);
  doc.line(mainX + progressW + progressGap / 2, progressTop, mainX + progressW + progressGap / 2, progressBottom);

  const instruction = "2 séries de 5 no mesmo peso. Completou as duas? Sobe na próxima sessão. Não completou? O peso recua e a contagem reinicia.";
  const instructionLines = doc.splitTextToSize(instruction, mainW - 4) as string[];
  const instructionH = 8.5 + instructionLines.length * 3.6;
  let instructionY = progressBottom + 3;
  if (instructionY + instructionH > bottomY) {
    doc.addPage();
    instructionY = margin;
  }
  doc.setFillColor(...SURFACE);
  doc.rect(mainX, instructionY, mainW, instructionH, "F");
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.rect(mainX, instructionY, mainW, instructionH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("REGRA DA RAMPA", mainX + 2, instructionY + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.text(instructionLines, mainX + 2, instructionY + 8.2);

  // ── TREINOS AUXILIARES ──────────────────────────────────────
  doc.addPage();
  y = margin;
  const colsTreino: StrengthCol[] = [
    { header: "SÉRIES/REPS", width: 30, strong: true },
    { header: "KG", width: 16, muted: true },
    { header: "CARGA", width: 16 },
  ];

  data.treinos.forEach((tr) => {
    ensurePage(38);
    y = sectionBar(doc, `Treino ${tr.ordem}`, `T${tr.ordem}`, mainX, y, mainW, 6.0);
    const auxiliares: StrengthRow[] = tr.auxiliares.map((aux) => ({
      cat: aux.categoria || "",
      nome: cleanName(aux.exercicio) || "—",
      cells: [`${aux.series}x${aux.reps}`, aux.kg ?? "", ""],
    }));
    y = drawStrengthTable(doc, { x: mainX, y, w: mainW, cols: colsTreino, groups: [auxiliares] }) + 2.4;
  });

  const nome = `PTTP-${student.nome.replace(/\s+/g, "-")}.pdf`;
  if (print) {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(nome);
  }
}
