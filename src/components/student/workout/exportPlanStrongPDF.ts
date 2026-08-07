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
  psSlots,
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

  // Slots de treino compartilhados (T1..Tn) — mesmos usados no editor
  const dias = psSlots(data.diasTreinoSemana);
  const diasHeader = dias;

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
  const cfgLabelW = 22;
  const cfgMesW = (mainW - cfgLabelW) / Math.max(1, data.duracaoMeses);
  const cfgColStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: cfgLabelW, fontStyle: "bold" },
  };
  for (let i = 0; i < data.duracaoMeses; i++) {
    cfgColStyles[i + 1] = { cellWidth: cfgMesW, halign: "center", overflow: "linebreak" };
  }
  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    tableWidth: mainW,
    theme: "plain",
    rowPageBreak: "avoid",
    head: [[
      { content: "", styles: { halign: "left" as const } },
      ...Array.from({ length: data.duracaoMeses }, (_, i) => ({
        content: `MÊS ${i + 1}`,
        styles: { halign: "center" as const },
      })),
    ]],
    body: [[
      "FASE",
      ...Array.from({ length: data.duracaoMeses }, (_, i) =>
        PS_FASE_LABEL[fasesRef[i]?.fase ?? "preparatorio"].toUpperCase(),
      ),
    ]],
    styles: commonStyles,
    headStyles: commonHeadStyles,
    columnStyles: cfgColStyles,
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
  // PÁGINAS SEGUINTES — planilha por grupo de levantamentos "casados"
  // (mesmo conjunto de slots => mesma página, lado a lado)
  // ============================================================
  type Cell = { content: string; colSpan?: number; styles?: Record<string, unknown> };

  const slotKey = (l: PSLevantamentoConfig) =>
    [...(l.diasTreino ?? [])].map((s) => s.trim().toUpperCase()).sort().join("|");

  const grupos: PSLevantamentoConfig[][] = [];
  const grupoIdx = new Map<string, number>();
  data.levantamentos.forEach((l) => {
    const k = slotKey(l);
    if (!k) {
      grupos.push([l]);
      return;
    }
    const gi = grupoIdx.get(k);
    if (gi === undefined) {
      grupoIdx.set(k, grupos.length);
      grupos.push([l]);
    } else {
      grupos[gi].push(l);
    }
  });

  grupos.forEach((grupo) => {
    doc.addPage();
    let ly = margin;
    const n = grupo.length;
    const titulo = grupo.map((l) => PS_LEV_LABEL[l.tipo].toUpperCase()).join(" + ");
    const slots = grupo[0].diasTreino?.length ? grupo[0].diasTreino.join(", ") : "";
    const rms = grupo
      .filter((l) => l.rm1)
      .map((l) => `${PS_LEV_LABEL[l.tipo]} 1RM ${l.rm1} KG`)
      .join("  ·  ");
    const right = [slots, rms].filter(Boolean).join("  ·  ");
    ly = sectionBar(doc, titulo, right || undefined, mainX, ly, mainW, 6.4);

    const totalCols = 1 + n * 2;
    const nMeses = Math.max(...grupo.map((l) => l.meses.length));
    const body: Cell[][] = [];

    for (let mesIdx = 0; mesIdx < nMeses; mesIdx++) {
      const faseRef = grupo[0].meses[mesIdx]?.fase ?? grupo.find((l) => l.meses[mesIdx])?.meses[mesIdx]?.fase;
      body.push([
        {
          content: `MÊS ${mesIdx + 1}${faseRef ? ` · ${PS_FASE_LABEL[faseRef]}` : ""}`,
          colSpan: totalCols,
          styles: {
            fillColor: INK,
            textColor: WHITE,
            fontStyle: "bold",
            halign: "left",
            fontSize: ROW_FONT,
          },
        },
      ]);

      const nSemanas = Math.max(...grupo.map((l) => l.meses[mesIdx]?.semanas.length ?? 0));
      for (let semanaIdx = 0; semanaIdx < nSemanas; semanaIdx++) {
        // sessões por levantamento
        const porLev = grupo.map((lev) => {
          const semana = lev.meses[mesIdx]?.semanas[semanaIdx];
          if (!semana) return { sessoes: [], nSessoes: 0, split: "" };
          const nSessoes = Math.max(1, semana.sessoes || 0);
          const fr = fracoesSessoes(nSessoes, semana.splitSessao);
          return {
            sessoes: fr.map((_, sIdx) => calcularSessao(lev, mesIdx, semanaIdx, sIdx)),
            nSessoes,
            split: semana.splitSessao ?? "",
          };
        });

        const linhasZona: Cell[][] = [];
        PS_ZONAS.forEach((z) => {
          const cells: Cell[] = [{ content: z.label, styles: { fontStyle: "bold" } }];
          let algum = false;
          porLev.forEach((pl) => {
            const partes: string[] = [];
            let kg = 0;
            pl.sessoes.forEach((s) => {
              const zs = s?.zonas.find((x) => x.zona === z.key);
              if (zs && zs.series) {
                partes.push(zs.series);
                kg = zs.kg;
              }
            });
            if (partes.length) algum = true;
            cells.push({ content: partes.length && kg ? `${kg} kg` : "—", styles: { halign: "right" } });
            cells.push({ content: partes.join("  ·  "), styles: {} });
          });
          if (algum) linhasZona.push(cells);
        });

        if (!linhasZona.length) continue;

        const resumo = grupo
          .map((lev, i) => {
            const pl = porLev[i];
            if (!pl.nSessoes) return null;
            const slotsLev = lev.diasTreino?.length ? lev.diasTreino.join(", ") : "";
            const s = `${pl.nSessoes} ${pl.nSessoes === 1 ? "sessão" : "sessões"}${slotsLev ? ` · ${slotsLev}` : ""}`;
            return n > 1 ? `${PS_LEV_LABEL[lev.tipo]}: ${s}` : s;
          })
          .filter(Boolean)
          .join("  ·  ");

        body.push([
          {
            content: `Semana ${semanaIdx + 1}${resumo ? `  ·  ${resumo}` : ""}`,
            colSpan: totalCols,
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
      }
    }

    if (!body.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sem volume configurado para este levantamento.", mainX, ly + 4);
      return;
    }

    const wZona = n > 2 ? 20 : 26;
    const wKg = n > 2 ? 13 : n === 2 ? 16 : 20;
    const wSeries = (mainW - wZona - n * wKg) / n;

    const head: Cell[][] = [[
      { content: "ZONA", styles: { halign: "left" as const } },
      ...grupo.flatMap(() => [
        { content: "KG", styles: { halign: "right" as const } },
        { content: n > 1 ? "SÉRIES" : "SÉRIES SUGERIDAS", styles: { halign: "left" as const } },
      ]),
    ]];

    const colStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wZona },
    };
    for (let i = 0; i < n; i++) {
      colStyles[1 + i * 2] = { cellWidth: wKg, halign: "right" };
      colStyles[2 + i * 2] = { cellWidth: wSeries, overflow: "linebreak" };
    }

    autoTable(doc, {
      startY: ly,
      margin: { left: mainX, right: pageW - (mainX + mainW), top: margin, bottom: pageH - bottomY },
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head,
      body,
      styles: { ...commonStyles, fontSize: n > 2 ? ROW_FONT - 1.2 : ROW_FONT },
      headStyles: { ...commonHeadStyles, fontSize: n > 2 ? HEAD_FONT - 0.8 : HEAD_FONT },
      columnStyles: colStyles,
      didParseCell: (hd) => {
        if (hd.section === "body" && hd.row.raw && (hd.row.raw as Cell[]).length === totalCols) {
          hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 } as unknown as number;
          hd.cell.styles.lineColor = INK_SOFT;
        }
      },
      didDrawCell: (hd) => {
        if (n <= 1) return;
        const raw = hd.row.raw as Cell[] | undefined;
        const isSpanRow = hd.section === "body" && Array.isArray(raw) && raw.length === 1;
        if (isSpanRow) {
          // linhas de mês/semana: desenha as divisórias manualmente sobre a célula mesclada
          const isMes = String(raw?.[0]?.content ?? "").startsWith("MÊS");
          doc.setDrawColor(...(isMes ? WHITE : RULE));
          doc.setLineWidth(0.15);
          for (let i = 1; i < n; i++) {
            const x = hd.cell.x + wZona + i * (wKg + wSeries);
            doc.line(x, hd.cell.y, x, hd.cell.y + hd.cell.height);
          }
          return;
        }
        // divisória vertical entre levantamentos (linhas de zona e cabeçalho)
        if (hd.column.index > 1 && (hd.column.index - 1) % 2 === 0) {
          doc.setDrawColor(...RULE);
          doc.setLineWidth(0.15);
          doc.line(hd.cell.x, hd.cell.y, hd.cell.x, hd.cell.y + hd.cell.height);
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
