import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { aquecimentoLabel, ordenarBlocosAquecimento } from "@/lib/aquecimentoBlocos";
import type { Tables } from "@/integrations/supabase/types";
import type { AquecimentoBloco, PersonalizadoAquecimentoEx } from "./personalizadoTypes";
import {
  type XFabConteudo,
  type XFabContagemTreinos,
  type XFabTreinoOrdem,
  XFAB_LEV_BASE,
  XFAB_PARES,
  XFAB_TREINOS,
  XFAB_MENSAGEM_CONCLUIDO,
  statusPar,
  sessaoAuxiliar,
  alvoLevantamento,
} from "@/lib/xfab";
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
  data: XFabConteudo;
  counts?: XFabContagemTreinos;
  print?: boolean;
}

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export async function exportXFabPDF({
  student,
  data,
  counts = { T1: 0, T2: 0, T3: 0 },
  print,
}: ExportArgs): Promise<void> {
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
  const tableMargin = { left: mainX, right: pageW - (mainX + mainW) };

  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, "X-FAB HIPERTROFIA");
  y = drawObservacoes(doc, mainX, y, mainW, 1, 2);

  if (data.observacoes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...INK_SOFT);
    const linhas = doc.splitTextToSize(data.observacoes.trim(), mainW);
    doc.text(linhas, mainX, y + 2.4);
    y += 2.4 + linhas.length * 3.2;
  }

  const dias = ["T1", "T2", "T3"];

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
  const wAlvo = 30;
  const wKg = 18;
  const wNomeBloco = 26;
  const wExercicio = mainW - (wNomeBloco + wAlvo + wKg);

  const colStylesTreino: Record<number, Record<string, unknown>> = {
    0: { cellWidth: wNomeBloco, fontStyle: "bold", textColor: INK_SOFT, overflow: "linebreak" },
    1: { cellWidth: wExercicio, overflow: "ellipsize" },
    2: { cellWidth: wAlvo, halign: "center", fontStyle: "bold" },
    3: { cellWidth: wKg, halign: "center" },
  };

  const desenharTabela = (
    body: string[][],
    subtitulo: string,
    meta: string,
  ) => {
    ensurePage(26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...INK);
    doc.text(subtitulo.toUpperCase(), mainX, y + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...INK_MUTED);
    doc.text(meta, mainX + mainW, y + 3, { align: "right" });
    y += 4.6;

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head: [[
        { content: "BLOCO", styles: { halign: "left" as const } },
        { content: "EXERCÍCIO", styles: { halign: "left" as const } },
        { content: "ALVO", styles: { halign: "center" as const } },
        { content: "KG", styles: { halign: "center" as const } },
      ]],
      body,
      styles: commonStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: colStylesTreino,
      didParseCell: (hd) => {
        if (hd.section === "body") {
          hd.cell.styles.lineWidth = {
            top: 0,
            right: 0,
            bottom: 0.25,
            left: 0,
          } as unknown as number;
          hd.cell.styles.lineColor = INK_SOFT;
        }
      },
    });
    y = lastY(doc) + 1.6;
  };

  ([1, 2, 3] as XFabTreinoOrdem[]).forEach((ordem) => {
    const estrutura = XFAB_TREINOS[ordem];
    const treino = data.treinos.find((t) => t.ordem === ordem);
    ensurePage(40);
    y = sectionBar(doc, `Treino ${ordem}`, `T${ordem}`, mainX, y, mainW, 6.0);

    // Levantamentos básicos — um bloco por par
    estrutura.pares.forEach((par, bi) => {
      const st = statusPar(counts, par);
      const linhas: string[][] = XFAB_PARES[par].map((lev) => {
        const base = XFAB_LEV_BASE[lev];
        if (st.phase === "concluded") {
          return [`Bloco ${bi + 1} · ${base.categoria}`, `${base.label} — ${cleanName(base.nome)}`, "—", ""];
        }
        const { alvo, kg } = alvoLevantamento(lev, st.proxima, data.rm);
        return [
          `Bloco ${bi + 1} · ${base.categoria}`,
          `${base.label} — ${cleanName(base.nome)}`,
          alvo,
          kg ? `${kg}` : "",
        ];
      });
      const meta =
        st.phase === "concluded"
          ? XFAB_MENSAGEM_CONCLUIDO
          : `Par ${par} · sessão ${st.proxima.sessao}/12`;
      desenharTabela(linhas, `Levantamentos básicos — Par ${par}`, meta);
    });

    // Auxiliares
    const planoAux = sessaoAuxiliar(counts, ordem);
    const linhasAux: string[][] = [];
    (treino?.blocosAuxiliares ?? estrutura.auxiliares.map((b) => b.map((c) => ({ categoria: c, exercicio: "" })))).forEach(
      (bloco, bi) => {
        bloco.forEach((ex) => {
          linhasAux.push([
            `Bloco ${bi + 3} · ${ex.categoria}`,
            cleanName(ex.exercicio) || "—",
            planoAux ? planoAux.auxiliar : "—",
            "",
          ]);
        });
      },
    );
    desenharTabela(
      linhasAux,
      "Auxiliares",
      planoAux ? `Sessão ${planoAux.sessao}/12` : XFAB_MENSAGEM_CONCLUIDO,
    );
    y += 1;
  });

  const nome = `XFAB-${student.nome.replace(/\s+/g, "-")}.pdf`;
  if (print) {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(nome);
  }
}
