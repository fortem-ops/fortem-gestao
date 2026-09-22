import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { aquecimentoLabel, ordenarBlocosAquecimento } from "@/lib/aquecimentoBlocos";
import type { Tables } from "@/integrations/supabase/types";
import type { AquecimentoBloco, PersonalizadoAquecimentoEx } from "./personalizadoTypes";
import {
  type PTTPConteudo,
  PTTP_LEV_BASE,
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
  drawObservacoes,
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
  const mainW = pageW - margin * 2;
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
  y = drawObservacoes(doc, mainX, y, mainW, 1, 2);

  if (data.observacoes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...INK_SOFT);
    const linhas = doc.splitTextToSize(data.observacoes.trim(), mainW);
    doc.text(linhas, mainX, y + 2.4);
    y += 2.4 + linhas.length * 3.2;
  }

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
    const wEx = mainW - (wNum + wCat + wT * nDias + wRep);

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

  // ── TREINOS ─────────────────────────────────────────────────
  const wBloco = 28;
  const wAlvo = 28;
  const wKg = 18;
  const wExercicio = mainW - (wBloco + wAlvo + wKg);

  const colStylesTreino: Record<number, Record<string, unknown>> = {
    0: { cellWidth: wBloco, fontStyle: "bold", textColor: INK_SOFT, overflow: "linebreak" },
    1: { cellWidth: wExercicio, overflow: "ellipsize" },
    2: { cellWidth: wAlvo, halign: "center", fontStyle: "bold" },
    3: { cellWidth: wKg, halign: "center" },
  };

  data.treinos.forEach((tr) => {
    ensurePage(44);
    y = sectionBar(doc, `Treino ${tr.ordem}`, `T${tr.ordem}`, mainX, y, mainW, 6.0);

    const linhas: string[][] = [];
    data.levantamentos.forEach((lev) => {
      const base = PTTP_LEV_BASE[lev.levantamento];
      const alvo = alvoPTTP(lev);
      linhas.push([
        `Central · ${base.categoria}`,
        `${lev.levantamento} — ${cleanName(base.nome)}`,
        alvo.esquema + (lev.modo === "manutencao" ? " (manut.)" : ""),
        alvo.peso ? `${alvo.peso}` : "",
      ]);
    });
    tr.auxiliares.forEach((aux, i) => {
      linhas.push([
        `Auxiliar ${i + 1} · ${aux.categoria || "—"}`,
        cleanName(aux.exercicio) || "—",
        `${aux.series}x${aux.reps}`,
        aux.kg ?? "",
      ]);
    });

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head: [[
        { content: "BLOCO", styles: { halign: "left" as const } },
        { content: "EXERCÍCIO", styles: { halign: "left" as const } },
        { content: "SÉRIES/REPS", styles: { halign: "center" as const } },
        { content: "KG", styles: { halign: "center" as const } },
      ]],
      body: linhas,
      styles: commonStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: colStylesTreino,
      didParseCell: bodyBorders,
    });
    y = lastY(doc) + 2;
  });

  // ── HISTÓRICO POR LEVANTAMENTO CENTRAL (tabela ampla) ───────
  data.levantamentos.forEach((lev) => {
    ensurePage(40);
    const alvo = alvoPTTP(lev);
    y = sectionBar(
      doc,
      `${lev.levantamento} — progressão`,
      `Próxima: ${alvo.esquema} @ ${alvo.peso || "—"} kg`,
      mainX,
      y,
      mainW,
      6.0,
    );

    const linhasHist: string[][] =
      lev.historico.length > 0
        ? lev.historico.map((h, i) => [
            `TREINO #${i + 1}`,
            h.data,
            `${h.peso} kg`,
            h.sucesso ? "✓" : "✗",
          ])
        : [["TREINO #1", "—", `${alvo.peso || "—"} kg`, ""]];

    // Linhas em branco para anotar as próximas sessões à mão.
    const emBranco = Math.max(0, 8 - linhasHist.length);
    for (let i = 0; i < emBranco; i++) {
      linhasHist.push([`TREINO #${linhasHist.length + 1}`, "", "", ""]);
    }

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head: [[
        { content: "SESSÃO", styles: { halign: "left" as const } },
        { content: "DATA", styles: { halign: "left" as const } },
        { content: "PESO", styles: { halign: "center" as const } },
        { content: "RESULTADO", styles: { halign: "center" as const } },
      ]],
      body: linhasHist,
      styles: commonStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: "bold", textColor: INK_SOFT },
        1: { cellWidth: 34 },
        2: { cellWidth: 28, halign: "center", fontStyle: "bold" },
        3: { cellWidth: mainW - 96, halign: "center" },
      },
      didParseCell: bodyBorders,
    });
    y = lastY(doc) + 2;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  ensurePage(6);
  doc.text(
    "Rampa: 2 séries de 5 no mesmo peso. Completou as duas → sobe na próxima sessão. Não completou → o peso recua e a contagem reinicia.",
    mainX,
    y + 3,
  );

  const nome = `PTTP-${student.nome.replace(/\s+/g, "-")}.pdf`;
  if (print) {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(nome);
  }
}
