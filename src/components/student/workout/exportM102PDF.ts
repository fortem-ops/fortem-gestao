import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import {
  type M102Conteudo,
  type M102Levantamento,
  type M102Slot,
  M102_SLOT_LEVANTAMENTOS,
  M102_LEV_BASE,
  schedule11,
  testSession,
  kgFor,
  rmForLevantamento,
} from "@/lib/m102";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "./personalizadoTypes";
import {
  INK,
  INK_SOFT,
  INK_MUTED,
  RULE,
  SURFACE,
  WHITE,
  RED,
  RED_SOFT,
  CHECK,
  cleanName,
  drawWorkoutHeader,
  sectionBar,
  drawObservacoes,
} from "./pdfShared";

interface ExportArgs {
  student: Tables<"alunos">;
  data: M102Conteudo;
  print?: boolean;
}

const AQ_LABELS: Record<AquecimentoBloco, string> = {
  LIB: "LIBERAÇÃO",
  MOB: "MOBILIDADE",
  ATI: "ATIVAÇÃO",
  PREV: "PREVENTIVOS",
};

const M102_DIAS_HEADER: readonly M102Slot[] = ["T1", "T2", "T3", "T4"];

/** Slots (A, B) que rodam cada levantamento — usado nas tabelas da página 2. */
const LIFT_SLOTS: Record<M102Levantamento, { A: M102Slot; B: M102Slot }> = {
  Terra: { A: "T1", B: "T3" },
  Supino: { A: "T1", B: "T3" },
  Agachamento: { A: "T2", B: "T4" },
  Remada: { A: "T2", B: "T4" },
};

const LIFT_ORDER: M102Levantamento[] = ["Terra", "Agachamento", "Remada", "Supino"];

const drawHeader = (
  doc: jsPDF,
  student: Tables<"alunos">,
  mainX: number,
  mainW: number,
  margin: number,
) => drawWorkoutHeader(doc, student, mainX, mainW, margin, "TREINO M102");

export async function exportM102PDF({
  student,
  data,
  print,
}: ExportArgs): Promise<void> {
  const aq = data.aquecimento;
  const aqBlocos: AquecimentoBloco[] = ["LIB", "MOB", "ATI", "PREV"];
  const gruposAtivos = aq
    ? aqBlocos.filter((k) => (aq[k]?.length ?? 0) > 0)
    : [];

  // ============================================================
  // PÁGINA 1 — auto-fit loop
  // ============================================================
  const MAX_ATTEMPTS = 14;
  let scale = 1.0;
  let doc!: jsPDF;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;
    const mainX = margin;
    const mainW = pageW - margin * 2;

    const S = scale;
    const ROW_FONT = Math.max(5.5, 8 * S);
    const HEAD_FONT = Math.max(4.6, 6.8 * S);
    const ROW_PAD = Math.max(0.28, 1.2 * S);
    const HEAD_PAD = Math.max(0.22, 1.0 * S);
    const SIDE_PAD = Math.max(0.5, 1.1 * S);
    const AQ_SUBBAR_H = Math.max(3.6, 5.4 * S);
    const AQ_BADGE_FONT = Math.max(5.5, 7.5 * S);
    const AQ_LABEL_FONT = Math.max(5.8, 7.8 * S);

    let y = drawHeader(doc, student, mainX, mainW, margin);
    y = drawObservacoes(doc, mainX, y, mainW, S, 3);

    // ============================================================
    // AQUECIMENTO
    // ============================================================
    if (gruposAtivos.length > 0) {
      y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW, Math.max(5.2, 6.4 * S));

      const wNum = Math.max(5, 6.4 * S);
      const wCat = Math.max(18, 22 * S);
      const wT = Math.max(6, 8 * S);
      const wRep = Math.max(10, 14 * S);
      const wKg = Math.max(12, 16 * S);
      const wEx = mainW - (wNum + wCat + wT * 4 + wRep + wKg);
      const catFont = Math.max(4.6, ROW_FONT - 1.2);

      const colStyles: Record<number, Record<string, unknown>> = {
        0: { cellWidth: wNum, halign: "center", fontStyle: "bold", textColor: INK_SOFT },
        1: {
          cellWidth: wCat,
          halign: "center",
          fontStyle: "bold",
          textColor: INK_SOFT,
          overflow: "linebreak",
          fontSize: catFont,
        },
        2: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold" },
      };
      for (let i = 0; i < 4; i++) {
        colStyles[3 + i] = { cellWidth: wT, halign: "center" };
      }
      colStyles[7] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };
      colStyles[8] = { cellWidth: wKg, halign: "right", textColor: INK_MUTED };

      gruposAtivos.forEach((g) => {
        const items = aq![g]!;

        const badgeW = 12;
        doc.setFillColor(...INK);
        doc.rect(mainX, y, badgeW, AQ_SUBBAR_H, "F");
        doc.setFillColor(...WHITE);
        doc.rect(mainX + badgeW, y, mainW - badgeW, AQ_SUBBAR_H, "F");
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.2);
        doc.line(mainX, y + AQ_SUBBAR_H, mainX + mainW, y + AQ_SUBBAR_H);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(AQ_BADGE_FONT);
        doc.setTextColor(...WHITE);
        doc.text(g, mainX + badgeW / 2, y + AQ_SUBBAR_H / 2 + 0.9, { align: "center" });
        doc.setFontSize(AQ_LABEL_FONT);
        doc.setTextColor(...INK);
        doc.text(AQ_LABELS[g], mainX + badgeW + 2, y + AQ_SUBBAR_H / 2 + 0.9);
        y += AQ_SUBBAR_H + 0.3;

        const body = items.map((ex: PersonalizadoAquecimentoEx, idx) => {
          const cells: (string | { content: string })[] = [
            String(idx + 1),
            (ex.subcategoria || "").toUpperCase(),
            cleanName(ex.exercicio) || "—",
          ];
          M102_DIAS_HEADER.forEach((d) => cells.push(ex.dias?.includes(d) ? CHECK : ""));
          cells.push(String(ex.repeticoes ?? ""));
          cells.push("");
          return cells;
        });

        const head = [[
          { content: "#", styles: { halign: "center" as const } },
          { content: "CAT", styles: { halign: "center" as const } },
          { content: "EXERCÍCIOS", styles: { halign: "left" as const } },
          ...M102_DIAS_HEADER.map((d) => ({ content: d, styles: { halign: "center" as const } })),
          { content: "REP.", styles: { halign: "right" as const } },
          { content: "KG", styles: { halign: "right" as const } },
        ]];

        autoTable(doc, {
          startY: y,
          margin: { left: mainX, right: pageW - (mainX + mainW) },
          tableWidth: mainW,
          theme: "plain",
          pageBreak: "avoid",
          rowPageBreak: "avoid",
          head,
          body,
          styles: {
            fontSize: ROW_FONT,
            cellPadding: { top: ROW_PAD, bottom: ROW_PAD, left: SIDE_PAD, right: SIDE_PAD },
            textColor: INK,
            lineColor: INK,
            lineWidth: 0,
            overflow: "ellipsize",
            minCellHeight: 0,
          },
          headStyles: {
            fillColor: WHITE,
            textColor: INK,
            fontStyle: "bold",
            fontSize: HEAD_FONT,
            cellPadding: { top: HEAD_PAD, bottom: HEAD_PAD, left: SIDE_PAD, right: SIDE_PAD },
            lineWidth: { bottom: 0.3 } as unknown as number,
            lineColor: INK,
          },
          alternateRowStyles: { fillColor: SURFACE },
          columnStyles: colStyles,
          didParseCell: (hd) => {
            if (hd.section === "body") {
              hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.25, left: 0 } as unknown as number;
              hd.cell.styles.lineColor = INK_SOFT;
              if (hd.column.index >= 3 && hd.column.index < 7) {
                if (hd.cell.text?.[0] === CHECK) hd.cell.text = [""];
              }
            }
          },
          didDrawCell: (hd) => {
            if (hd.section === "body" && hd.column.index >= 3 && hd.column.index < 7) {
              const row = items[hd.row.index];
              const tKey = `T${hd.column.index - 2}`;
              if (row?.dias?.includes(tKey)) {
                const cx = hd.cell.x + hd.cell.width / 2;
                const cy = hd.cell.y + hd.cell.height / 2;
                doc.setFillColor(...RED_SOFT);
                doc.circle(cx, cy, Math.max(0.7, ROW_FONT * 0.13), "F");
              }
              if (hd.column.index > 3) {
                const x = hd.cell.x;
                doc.setDrawColor(...RULE);
                doc.setLineWidth(0.12);
                doc.line(x, hd.cell.y + 0.4, x, hd.cell.y + hd.cell.height - 0.4);
              }
            }
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 0.8;
      });
    }

    // ============================================================
    // TREINOS 1..4 — exercícios daquele dia
    // ============================================================
    data.treinos.forEach((tr) => {
      const slot = `T${tr.ordem}` as M102Slot;
      const levs = M102_SLOT_LEVANTAMENTOS[slot].map((x) => x.levantamento.toUpperCase());
      const titulo = `TREINO ${tr.ordem} · ${levs.join(" + ")}`;
      y = sectionBar(doc, titulo, undefined, mainX, y, mainW, Math.max(5.0, 6.0 * S));

      const wNum2 = Math.max(6, 8 * S);
      const wCat2 = Math.max(14, 18 * S);
      const wSer = Math.max(14, 20 * S);
      const wRep2 = Math.max(16, 22 * S);
      const wKg2 = Math.max(16, 22 * S);
      const wEx2 = mainW - (wNum2 + wCat2 + wSer + wRep2 + wKg2);
      const catFont2 = Math.max(4.6, ROW_FONT - 1.2);

      const head = [[
        { content: "#", styles: { halign: "center" as const } },
        { content: "CAT", styles: { halign: "center" as const } },
        { content: "EXERCÍCIO", styles: { halign: "left" as const } },
        { content: "SÉRIES", styles: { halign: "center" as const } },
        { content: "REP.", styles: { halign: "center" as const } },
        { content: "KG", styles: { halign: "right" as const } },
      ]];

      const commonColStyles: Record<number, Record<string, unknown>> = {
        0: { cellWidth: wNum2, halign: "center", fontStyle: "bold", textColor: INK_SOFT },
        1: {
          cellWidth: wCat2,
          halign: "center",
          fontStyle: "bold",
          textColor: INK_SOFT,
          overflow: "linebreak",
          fontSize: catFont2,
        },
        2: { cellWidth: wEx2, fontStyle: "bold" },
        3: { cellWidth: wSer, halign: "center" },
        4: { cellWidth: wRep2, halign: "center" },
        5: { cellWidth: wKg2, halign: "right", fontStyle: "bold" },
      };

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

      // Bloco 1: levantamentos básicos
      const baseRows = M102_SLOT_LEVANTAMENTOS[slot].map((b, idx) => {
        const info = M102_LEV_BASE[b.levantamento];
        return [
          String(idx + 1),
          info.categoria,
          `${b.levantamento.toUpperCase()} — ${cleanName(info.nome)}`,
          "PLANILHA",
          "PLANILHA",
          "PLANILHA",
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: mainX, right: pageW - (mainX + mainW) },
        tableWidth: mainW,
        theme: "plain",
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        head,
        body: baseRows,
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: SURFACE },
        columnStyles: commonColStyles,
        didParseCell: (hd) => {
          if (hd.section === "body") {
            hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
            hd.cell.styles.lineColor = INK_SOFT;
            if (hd.column.index >= 3) {
              hd.cell.styles.textColor = INK_MUTED;
              hd.cell.styles.fontStyle = "italic";
            }
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 0.8;

      // Bloco 2: acessórios (renumerados)
      if (tr.acessorios.length > 0) {
        const accRows = tr.acessorios.map((a, idx) => [
          String(idx + 1),
          (a.categoria || "").toUpperCase(),
          cleanName(a.exercicio) || "—",
          String(a.series ?? ""),
          a.reps ?? "",
          a.kg ?? "",
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: mainX, right: pageW - (mainX + mainW) },
          tableWidth: mainW,
          theme: "plain",
          pageBreak: "avoid",
          rowPageBreak: "avoid",
          head,
          body: accRows,
          styles: commonStyles,
          headStyles: commonHeadStyles,
          alternateRowStyles: { fillColor: SURFACE },
          columnStyles: commonColStyles,
          didParseCell: (hd) => {
            if (hd.section === "body") {
              hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
              hd.cell.styles.lineColor = INK_SOFT;
            }
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.4;
      } else {
        y += 0.6;
      }
    });

    if (doc.getNumberOfPages() === 1) break;
    scale *= 0.92;
  }

  // ============================================================
  // PÁGINA 2 — TABELAS DE PERIODIZAÇÃO POR LEVANTAMENTO
  // ============================================================
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const mainX = margin;
  const mainW = pageW - margin * 2;
  const bottomY = pageH - margin;

  doc.addPage();
  let y = drawHeader(doc, student, mainX, mainW, margin);

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = drawHeader(doc, student, mainX, mainW, margin);
    }
  };

  const sched = schedule11(data.percentualInicial);

  // Layout de colunas: SEM | (SET#1..SET#5, INT, KG)×2
  const wSem = 14;
  const slotAreaW = (mainW - wSem) / 2;
  const wSet = slotAreaW * 0.11;
  const wInt = slotAreaW * 0.22;
  const wKg = slotAreaW - wSet * 5 - wInt;
  const P2_ROW = 6.6;
  const P2_HEAD = 6.0;
  const P2_PAD = 0.9;

  LIFT_ORDER.forEach((lev) => {
    const rm = rmForLevantamento(data.rm, lev);
    const slots = LIFT_SLOTS[lev];
    const nomeBanco = M102_LEV_BASE[lev].nome;

    ensureSpace(80);
    y = sectionBar(
      doc,
      `${lev.toUpperCase()} · ${cleanName(nomeBanco).toUpperCase()}  ·  1RM ${rm} KG`,
      undefined,
      mainX,
      y,
      mainW,
    );

    type Cell =
      | string
      | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };

    const slotHeaderStyle = {
      fillColor: INK,
      textColor: WHITE,
      fontStyle: "bold" as const,
      halign: "center" as const,
      fontSize: P2_HEAD + 0.4,
    };
    const subHeaderStyle = {
      fillColor: SURFACE,
      textColor: INK,
      fontStyle: "bold" as const,
      halign: "center" as const,
      fontSize: P2_HEAD - 0.4,
    };

    const body: Cell[][] = [];
    body.push([
      { content: "", styles: { fillColor: WHITE } },
      { content: `TREINO #${slots.A.slice(1)} (A)`, colSpan: 7, styles: slotHeaderStyle },
      { content: `TREINO #${slots.B.slice(1)} (B)`, colSpan: 7, styles: slotHeaderStyle },
    ]);
    body.push([
      { content: "SEM", styles: subHeaderStyle },
      ...(["SET#1", "SET#2", "SET#3", "SET#4", "SET#5", "INTENS.", "KG"].flatMap((h) => [
        { content: h, styles: subHeaderStyle },
      ]) as Cell[]),
      ...(["SET#1", "SET#2", "SET#3", "SET#4", "SET#5", "INTENS.", "KG"].flatMap((h) => [
        { content: h, styles: subHeaderStyle },
      ]) as Cell[]),
    ]);

    // Linhas por semana
    sched.forEach((s, i) => {
      const kg = kgFor(rm, s.pct);
      const setCells = (reps: number): Cell[] => {
        const arr: Cell[] = [];
        for (let k = 0; k < 5; k++) {
          arr.push({
            content: k < s.series ? String(reps) : "-",
            styles: {
              halign: "center" as const,
              fontSize: P2_ROW,
              textColor: k < s.series ? INK : INK_MUTED,
            },
          });
        }
        arr.push({
          content: `${s.pct}%`,
          styles: { halign: "center" as const, fontSize: P2_ROW, fontStyle: "bold", textColor: RED },
        });
        arr.push({
          content: kg > 0 ? `${kg}` : "—",
          styles: { halign: "center" as const, fontSize: P2_ROW, fontStyle: "bold" },
        });
        return arr;
      };
      body.push([
        {
          content: `SEM ${i + 1}`,
          styles: {
            fillColor: SURFACE,
            fontStyle: "bold" as const,
            halign: "center" as const,
            fontSize: P2_ROW,
          },
        },
        ...setCells(s.repsA),
        ...setCells(s.repsB),
      ]);
    });

    // Linha SEM 12 · TESTE MÁX (compartilhada entre slots A e B).
    const test = testSession(rm);
    const testInline = test.map((t) => `${t.reps}×${t.pct}% (${t.kg}kg)`).join("   ·   ");
    body.push([
      {
        content: "SEM 12 · TESTE MÁX",
        styles: {
          fillColor: INK,
          textColor: WHITE,
          fontStyle: "bold" as const,
          halign: "center" as const,
          fontSize: P2_ROW,
        },
      },
      {
        content: testInline,
        colSpan: 14,
        styles: {
          fillColor: SURFACE,
          textColor: INK,
          fontStyle: "bold" as const,
          halign: "center" as const,
          fontSize: P2_ROW,
        },
      },
    ]);

    const colStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wSem },
    };
    for (let side = 0; side < 2; side++) {
      const off = 1 + side * 7;
      for (let k = 0; k < 5; k++) colStyles[off + k] = { cellWidth: wSet };
      colStyles[off + 5] = { cellWidth: wInt };
      colStyles[off + 6] = { cellWidth: wKg };
    }

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      body,
      styles: {
        fontSize: P2_ROW,
        cellPadding: { top: P2_PAD, bottom: P2_PAD, left: 0.6, right: 0.6 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: 0.05,
        overflow: "ellipsize",
        minCellHeight: 0,
      },
      columnStyles: colStyles,
      didParseCell: (hd) => {
        if (hd.section === "body") {
          hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.1, left: 0 } as unknown as number;
          hd.cell.styles.lineColor = RULE;
        }
      },
      didDrawCell: (hd) => {
        // Divisória vertical grossa entre os dois slots (na fronteira).
        if (hd.column.index !== 0) return;
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.5);
        const lineX = mainX + wSem + (wSet * 5 + wInt + wKg);
        doc.line(lineX, hd.cell.y, lineX, hd.cell.y + hd.cell.height);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  });

  const safeName = student.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `treino-m102-${safeName}.pdf`;

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(filename);
  }
}
