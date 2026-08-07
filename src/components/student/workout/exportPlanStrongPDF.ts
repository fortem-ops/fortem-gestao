import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import {
  type PlanStrong50Conteudo,
  type PSLevantamentoConfig,
  PS_LEV_LABEL,
  PS_LEV_BASE,
  PS_ZONAS,
  PS_FASE_LABEL,
  calcularSessao,
  fracoesSessoes,
} from "@/lib/planStrong";
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
  RED_SOFT,
  CHECK,
  cleanName,
  drawWorkoutHeader,
  sectionBar,
  drawObservacoes,
} from "./pdfShared";

interface ExportArgs {
  student: Tables<"alunos">;
  data: PlanStrong50Conteudo;
  print?: boolean;
}

const AQ_LABELS: Record<AquecimentoBloco, string> = {
  LIB: "LIBERAÇÃO",
  MOB: "MOBILIDADE",
  ATI: "ATIVAÇÃO",
  PREV: "PREVENTIVOS",
};

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export async function exportPlanStrongPDF({
  student,
  data,
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

  // ============================================================
  // PÁGINA 1 — visão geral
  // ============================================================
  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, "PLAN STRONG 50");
  y = drawObservacoes(doc, mainX, y, mainW, 1, 3);

  // Dias de treino = rótulos usados no aquecimento (um por levantamento configurado)
  const dias = data.levantamentos.map((l) => PS_LEV_LABEL[l.tipo]);
  const diasHeader = dias.map((_, i) => `T${i + 1}`);

  // ── AQUECIMENTO ───────────────────────────────────────────
  const aq = data.aquecimento;
  const aqBlocos: AquecimentoBloco[] = ["LIB", "MOB", "ATI", "PREV"];
  const gruposAtivos = aq ? aqBlocos.filter((k) => (aq[k]?.length ?? 0) > 0) : [];

  if (gruposAtivos.length > 0) {
    y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW, 6.4);

    const nDias = Math.max(1, diasHeader.length);
    const wNum = 6.4;
    const wCat = 22;
    const wT = 8;
    const wRep = 14;
    const wKg = 16;
    const wEx = mainW - (wNum + wCat + wT * nDias + wRep + wKg);

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
    colStyles[3 + nDias] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };
    colStyles[4 + nDias] = { cellWidth: wKg, halign: "right", textColor: INK_MUTED };

    const head = [[
      { content: "#", styles: { halign: "center" as const } },
      { content: "CAT", styles: { halign: "center" as const } },
      { content: "EXERCÍCIOS", styles: { halign: "left" as const } },
      ...diasHeader.map((d) => ({ content: d, styles: { halign: "center" as const } })),
      { content: "REP.", styles: { halign: "right" as const } },
      { content: "KG", styles: { halign: "right" as const } },
    ]];

    gruposAtivos.forEach((g) => {
      const items = aq[g]!;
      const SUBBAR_H = 5.4;
      const badgeW = 12;
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
      doc.text(AQ_LABELS[g], mainX + badgeW + 2, y + SUBBAR_H / 2 + 0.9);
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

  // ── CONFIGURAÇÃO (meses/fases) ────────────────────────────
  const fasesRef = data.levantamentos[0]?.meses ?? [];
  y = sectionBar(doc, "Configuração", `${data.duracaoMeses} ${data.duracaoMeses === 1 ? "mês" : "meses"}`, mainX, y, mainW, 6.0);
  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    tableWidth: mainW,
    theme: "plain",
    rowPageBreak: "avoid",
    head: [[
      { content: "MÊS", styles: { halign: "left" as const } },
      { content: "FASE", styles: { halign: "left" as const } },
    ]],
    body: Array.from({ length: data.duracaoMeses }, (_, i) => [
      `Mês ${i + 1}`,
      PS_FASE_LABEL[fasesRef[i]?.fase ?? "preparatorio"],
    ]),
    styles: commonStyles,
    headStyles: commonHeadStyles,
    alternateRowStyles: { fillColor: SURFACE },
    columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" } },
    didParseCell: (hd) => {
      if (hd.section === "body") {
        hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
        hd.cell.styles.lineColor = INK_SOFT;
      }
    },
  });
  y = lastY(doc) + 2;

  // ── LEVANTAMENTOS ─────────────────────────────────────────
  y = sectionBar(doc, "Levantamentos", undefined, mainX, y, mainW, 6.0);
  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    tableWidth: mainW,
    theme: "plain",
    rowPageBreak: "avoid",
    head: [[
      { content: "LEVANTAMENTO", styles: { halign: "left" as const } },
      { content: "EXERCÍCIO", styles: { halign: "left" as const } },
      { content: "1RM", styles: { halign: "right" as const } },
      { content: "DIAS", styles: { halign: "left" as const } },
      { content: "PLANILHA", styles: { halign: "left" as const } },
    ]],
    body: data.levantamentos.map((l) => [
      PS_LEV_LABEL[l.tipo].toUpperCase(),
      cleanName(PS_LEV_BASE[l.tipo].nome),
      l.rm1 ? `${l.rm1} kg` : "—",
      l.diasTreino.length ? l.diasTreino.join(", ") : "—",
      "ver planilha nas próximas páginas",
    ]),
    styles: commonStyles,
    headStyles: commonHeadStyles,
    alternateRowStyles: { fillColor: SURFACE },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: "bold" },
      2: { cellWidth: 16, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 28 },
      4: { cellWidth: 48, textColor: INK_MUTED, fontStyle: "italic" },
    },
    didParseCell: (hd) => {
      if (hd.section === "body") {
        hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
        hd.cell.styles.lineColor = INK_SOFT;
      }
    },
  });

  // ============================================================
  // PÁGINAS SEGUINTES — planilha por levantamento
  // ============================================================
  type Cell = { content: string; colSpan?: number; styles?: Record<string, unknown> };

  data.levantamentos.forEach((lev: PSLevantamentoConfig) => {
    doc.addPage();
    let ly = margin;
    const base = PS_LEV_BASE[lev.tipo];
    ly = sectionBar(
      doc,
      `${PS_LEV_LABEL[lev.tipo]} · ${cleanName(base.nome)}`,
      lev.rm1 ? `1RM ${lev.rm1} KG` : undefined,
      mainX,
      ly,
      mainW,
      6.4,
    );

    const body: Cell[][] = [];

    lev.meses.forEach((mes, mesIdx) => {
      body.push([
        {
          content: `MÊS ${mesIdx + 1} · ${PS_FASE_LABEL[mes.fase]}`,
          colSpan: 3,
          styles: {
            fillColor: INK,
            textColor: WHITE,
            fontStyle: "bold",
            halign: "left",
            fontSize: ROW_FONT,
          },
        },
      ]);

      mes.semanas.forEach((semana, semanaIdx) => {
        const nSessoes = Math.max(1, semana.sessoes || 0);
        const fr = fracoesSessoes(nSessoes, semana.splitSessao);
        const sessoes = fr.map((_, sIdx) => calcularSessao(lev, mesIdx, semanaIdx, sIdx));

        const linhasZona: Cell[][] = [];
        PS_ZONAS.forEach((z) => {
          const partes: string[] = [];
          let kg = 0;
          sessoes.forEach((s) => {
            const zs = s?.zonas.find((x) => x.zona === z.key);
            if (zs && zs.series) {
              partes.push(zs.series);
              kg = zs.kg;
            }
          });
          if (!partes.length) return;
          linhasZona.push([
            { content: z.label, styles: { fontStyle: "bold" } },
            { content: kg ? `${kg} kg` : "—", styles: { halign: "right" } },
            { content: partes.join("  ·  "), styles: {} },
          ]);
        });

        if (!linhasZona.length) return;

        body.push([
          {
            content: `Semana ${semanaIdx + 1}  ·  ${nSessoes} ${nSessoes === 1 ? "sessão" : "sessões"}${semana.splitSessao ? ` (${semana.splitSessao})` : ""}`,
            colSpan: 3,
            styles: {
              fillColor: SURFACE,
              textColor: INK,
              fontStyle: "bold",
              halign: "left",
              fontSize: ROW_FONT - 0.6,
            },
          },
        ]);
        body.push(...linhasZona);
      });
    });

    if (!body.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sem volume configurado para este levantamento.", mainX, ly + 4);
      return;
    }

    autoTable(doc, {
      startY: ly,
      margin: { left: mainX, right: pageW - (mainX + mainW), top: margin, bottom: pageH - bottomY },
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head: [[
        { content: "ZONA", styles: { halign: "left" as const } },
        { content: "KG", styles: { halign: "right" as const } },
        { content: "SÉRIES SUGERIDAS", styles: { halign: "left" as const } },
      ]],
      body,
      styles: commonStyles,
      headStyles: commonHeadStyles,
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: mainW - 46, overflow: "linebreak" },
      },
      didParseCell: (hd) => {
        if (hd.section === "body" && hd.row.raw && (hd.row.raw as Cell[]).length === 3) {
          hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
          hd.cell.styles.lineColor = INK_SOFT;
        }
      },
    });
  });

  const safeName = student.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `plan-strong-50-${safeName}.pdf`;

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(filename);
  }
}
