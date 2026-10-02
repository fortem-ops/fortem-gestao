import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { aquecimentoLabel, ordenarBlocosAquecimento } from "@/lib/aquecimentoBlocos";
import type { Tables } from "@/integrations/supabase/types";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "./personalizadoTypes";
import {
  type Planilha5RMConteudo,
  type ExercicioPlanilha5RM,
  PLANILHA5RM_BLOCO_PRINCIPAL_LABEL,
  PLANILHA5RM_BLOCO_ACESSORIO_LABEL,
  PLANILHA5RM_VOLUME_PRINCIPAL,
  PLANILHA5RM_VOLUME_PRINCIPAL_NOTA,
  PLANILHA5RM_VOLUME_ACESSORIO,
} from "@/lib/planilha5rm";
import {
  INK,
  INK_SOFT,
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
  warmupCategoryColumnStyle,
  drawStrengthTable,
  type StrengthCol,
  type StrengthRow,
} from "./pdfShared";

interface ExportArgs {
  student: Tables<"alunos">;
  data: Planilha5RMConteudo;
  print?: boolean;
}

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export async function exportPlanilha5RMPDF({ student, data, print }: ExportArgs): Promise<void> {
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
  const tableMargin = { left: mainX, right: pageW - (mainX + mainW) };

  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, "PLANILHA 5RM");
  drawFrequencyColumn(doc, freqX, freqColW, margin, bottomY, data.frequencia, 4);
  y = drawPrescriptionObservations(doc, mainX, y, mainW, data.observacoes, 1, 3);

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

    const nDias = Math.max(1, dias.length);
    const wNum = 6.4;
    const wCat = 25;
    const wT = 8;
    const wRep = 14;
    const wCarga = 13;
    const wEx = mainW - (wNum + wCat + wT * nDias + wRep + wCarga);

    const colStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wNum, halign: "center", fontStyle: "bold", textColor: INK_SOFT },
      1: warmupCategoryColumnStyle(
        doc,
        gruposAtivos.flatMap((g) => (aq?.[g] ?? []).map((ex) => ex.subcategoria)),
        wCat,
        ROW_FONT - 1.2,
        SIDE_PAD,
      ),
      2: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold" },
    };
    for (let i = 0; i < nDias; i++) colStyles[3 + i] = { cellWidth: wT, halign: "center" };
    colStyles[3 + nDias] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };
    colStyles[4 + nDias] = { cellWidth: wCarga, halign: "center" };

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
            hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.25, left: 0 } as unknown as number;
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

  // ── PÁGINA 2: Volume/Intensidade no topo + 4 treinos em largura total ──
  doc.addPage();
  y = margin;
  const fullW = pageW - margin * 2;
  const fullMargin = { left: mainX, right: margin };

  y = sectionBar(doc, "Volume / Intensidade", "referência fixa do método", mainX, y, fullW, 6.0);
  const wLabel = 52;
  const wSem = (fullW - wLabel) / 4;
  autoTable(doc, {
    startY: y,
    margin: fullMargin,
    tableWidth: fullW,
    theme: "plain",
    rowPageBreak: "avoid",
    head: [[
      { content: "", styles: { halign: "left" as const } },
      { content: "S1", styles: { halign: "center" as const } },
      { content: "S2", styles: { halign: "center" as const } },
      { content: "S3", styles: { halign: "center" as const } },
      { content: "S4", styles: { halign: "center" as const } },
    ]],
    body: [
      [
        `${PLANILHA5RM_BLOCO_PRINCIPAL_LABEL} (${PLANILHA5RM_VOLUME_PRINCIPAL_NOTA})`,
        ...PLANILHA5RM_VOLUME_PRINCIPAL.map((v) => v.texto),
      ],
      [
        PLANILHA5RM_BLOCO_ACESSORIO_LABEL,
        PLANILHA5RM_VOLUME_ACESSORIO,
        PLANILHA5RM_VOLUME_ACESSORIO,
        PLANILHA5RM_VOLUME_ACESSORIO,
        PLANILHA5RM_VOLUME_ACESSORIO,
      ],
    ],
    styles: commonStyles,
    headStyles: commonHeadStyles,
    columnStyles: {
      0: { cellWidth: wLabel, fontStyle: "bold", overflow: "linebreak" },
      1: { cellWidth: wSem, halign: "center" },
      2: { cellWidth: wSem, halign: "center" },
      3: { cellWidth: wSem, halign: "center" },
      4: { cellWidth: wSem, halign: "center" },
    },
    didParseCell: (hd) => {
      if (hd.section === "body") {
        hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
        hd.cell.styles.lineColor = INK_SOFT;
      }
    },
  });
  y = lastY(doc) + 3;

  // Lista única por treino (modelo Personalizado): CAT | EXERCÍCIO | S1–S4.
  // Básicos × acessórios separados só por linha grossa. S1–S4 já são os campos
  // manuais de carga semanal — sem coluna extra de CARGA na força.
  const colsTreino: StrengthCol[] = [
    { header: "S1", width: 18 },
    { header: "S2", width: 18 },
    { header: "S3", width: 18 },
    { header: "S4", width: 18 },
  ];
  const toRow = (ex: ExercicioPlanilha5RM): StrengthRow => ({
    cat: ex.categoria || "",
    nome: cleanName(ex.exercicio) || "—",
    cells: [ex.kgSemanas[0] || "", ex.kgSemanas[1] || "", ex.kgSemanas[2] || "", ex.kgSemanas[3] || ""],
  });

  data.treinos.forEach((treino) => {
    ensurePage(34);
    y = sectionBar(doc, `Treino ${treino.ordem}`, undefined, mainX, y, fullW, 6.0);
    y = drawStrengthTable(doc, {
      x: mainX,
      y,
      w: fullW,
      cols: colsTreino,
      groups: [treino.blocoPrincipal.map(toRow), treino.blocoAcessorio.map(toRow)],
    }) + 2.4;
  });

  const nome = `Planilha5RM-${student.nome.replace(/\s+/g, "-")}.pdf`;
  if (print) {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(nome);
  }
}
