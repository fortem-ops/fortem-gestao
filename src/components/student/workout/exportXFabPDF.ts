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
  drawFrequencyColumn,
  drawPrescriptionObservations,
  warmupCategoryColumnStyle,
  drawStrengthTable,
  type StrengthCol,
  type StrengthRow,
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

  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, "X-FAB HIPERTROFIA");
  drawFrequencyColumn(doc, freqX, freqColW, margin, bottomY, 3, 4);
  y = drawPrescriptionObservations(doc, mainX, y, mainW, data.observacoes, 1, 2);

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

  // ── TREINOS ─────────────────────────────────────────────────
  // Lista única por treino (modelo Personalizado): CAT | EXERCÍCIO | ALVO | KG | CARGA.
  const colsTreino: StrengthCol[] = [
    { header: "ALVO", width: 30, strong: true },
    { header: "KG", width: 16, muted: true },
    { header: "CARGA", width: 16 },
  ];

  ([1, 2, 3] as XFabTreinoOrdem[]).forEach((ordem) => {
    const estrutura = XFAB_TREINOS[ordem];
    const treino = data.treinos.find((t) => t.ordem === ordem);
    ensurePage(40);

    const metas: string[] = [];
    const principais: StrengthRow[] = [];
    estrutura.pares.forEach((par) => {
      const st = statusPar(counts, par);
      metas.push(st.phase === "concluded" ? `Par ${par} concluído` : `Par ${par} · ${st.proxima.sessao}/12`);
      XFAB_PARES[par].forEach((lev) => {
        const base = XFAB_LEV_BASE[lev];
        const nome = `${base.label} — ${cleanName(base.nome)}`;
        if (st.phase === "concluded") {
          principais.push({ cat: base.categoria, nome, cells: ["—", "", ""] });
          return;
        }
        const { alvo, kg } = alvoLevantamento(lev, st.proxima, data.rm);
        principais.push({ cat: base.categoria, nome, cells: [alvo, kg ? `${kg}` : "", ""] });
      });
    });

    const planoAux = sessaoAuxiliar(counts, ordem);
    metas.push(planoAux ? `Aux ${planoAux.sessao}/12` : "Aux concluído");
    const auxiliares: StrengthRow[] = [];
    (treino?.blocosAuxiliares ?? estrutura.auxiliares.map((b) => b.map((c) => ({ categoria: c, exercicio: "" })))).forEach(
      (bloco) => {
        bloco.forEach((ex) => {
          auxiliares.push({
            cat: ex.categoria || "",
            nome: cleanName(ex.exercicio) || "—",
            cells: [planoAux ? planoAux.auxiliar : "—", "", ""],
          });
        });
      },
    );

    y = sectionBar(doc, `Treino ${ordem}`, metas.join("  ·  "), mainX, y, mainW, 6.0);
    y = drawStrengthTable(doc, { x: mainX, y, w: mainW, cols: colsTreino, groups: [principais, auxiliares] }) + 2.4;
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
