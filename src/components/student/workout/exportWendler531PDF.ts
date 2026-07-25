import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import fortemLogo from "@/assets/fortem-logo-pdf.png";
import {
  type Wendler531Conteudo,
  LEVANTAMENTO_EXERCICIO_BASE,
  computeWave,
  trainingMax,
  roundToNearest2_5,
  acessorioKg,
} from "@/lib/wendler531";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "./personalizadoTypes";

interface ExportArgs {
  student: Tables<"alunos">;
  data: Wendler531Conteudo;
  print?: boolean;
}

// Palette — mirrors exportWorkoutPDF.ts.
const INK: [number, number, number] = [24, 24, 27];
const INK_SOFT: [number, number, number] = [82, 82, 91];
const INK_MUTED: [number, number, number] = [161, 161, 170];
const RULE: [number, number, number] = [113, 113, 122];
const SURFACE: [number, number, number] = [212, 212, 216];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [185, 28, 28];
const RED_SOFT: [number, number, number] = [220, 38, 38];
const RED_TINT: [number, number, number] = [254, 226, 226];

const CHECK = "•DOT•";

const cleanName = (s?: string | null) =>
  (s ?? "").replace(/^\s*\d+\s*[-–—.)]\s*/, "").trim();

// Intensidade → cor de fundo para linhas da onda 5-3-1.
const AQUEC_TINT: [number, number, number] = [220, 240, 220];   // verde bem claro
const TRAB_TINT: [number, number, number] = [253, 214, 214];    // vermelho/salmão claro-médio
const AMRAP_TINT: [number, number, number] = [248, 160, 160];   // vermelho mais saturado

function drawHeader(
  doc: jsPDF,
  student: Tables<"alunos">,
  mainX: number,
  mainW: number,
  margin: number,
): number {
  // Nome do aluno — topo ESQUERDO, bold, maiúsculo.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(student.nome.toUpperCase(), mainX, margin + 7);

  // Logo — topo DIREITO.
  try {
    const LOGO_H = 8;
    const LOGO_RATIO = 1920 / 357;
    const LOGO_W = LOGO_H * LOGO_RATIO;
    doc.addImage(fortemLogo, "PNG", mainX + mainW - LOGO_W, margin + 1, LOGO_W, LOGO_H);
  } catch {
    // ignore
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_SOFT);
  doc.text(today, mainX + mainW, margin + 13, { align: "right" });

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(mainX, margin + 16, mainX + mainW, margin + 16);

  return margin + 16 + 3;
}

function sectionBar(
  doc: jsPDF,
  label: string,
  meta: string | undefined,
  x: number,
  y: number,
  w: number,
): number {
  const H = 6.4;
  doc.setFillColor(...RED);
  doc.rect(x, y, w, H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(label.toUpperCase(), x + 2.4, y + H / 2 + 1.1);
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(meta, x + w - 2, y + H / 2 + 1.1, { align: "right" });
  }
  return y + H + 1.2;
}

function drawFrequenciaColumn(
  doc: jsPDF,
  freqX: number,
  freqColW: number,
  freqTopY: number,
  freqBottomY: number,
  activeT: number,
  weeks: number,
): void {
  const freqHeaderH = 10;
  doc.setFillColor(...RED);
  doc.rect(freqX, freqTopY, freqColW, freqHeaderH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FREQUÊNCIA", freqX + freqColW / 2, freqTopY + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.text(
    `${weeks} ${weeks === 1 ? "SEMANA" : "SEMANAS"}`,
    freqX + freqColW / 2,
    freqTopY + 7.6,
    { align: "center" },
  );

  const slotCount = weeks * activeT;
  const slotsTop = freqTopY + freqHeaderH + 1;
  const slotsAvailH = freqBottomY - slotsTop;
  const slotH = slotsAvailH / slotCount;

  for (let i = 0; i < slotCount; i++) {
    const sy = slotsTop + i * slotH;
    const week = Math.floor(i / activeT) + 1;
    const tNum = (i % activeT) + 1;

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
}

export async function exportWendler531PDF({
  student,
  data,
  print,
}: ExportArgs): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const gutter = 4;
  const freqColW = 22;
  const mainX = margin;
  const mainW = pageW - margin * 2 - freqColW - gutter;
  const freqX = mainX + mainW + gutter;
  const bottomY = pageH - margin;

  const freq = data.frequencia;
  const diasHeader = Array.from({ length: freq }, (_, i) => `T${i + 1}`);

  // Cabeçalho + coluna FREQUÊNCIA (semanas fixas = 4 no 5-3-1)
  let y = drawHeader(doc, student, mainX, mainW, margin);
  drawFrequenciaColumn(doc, freqX, freqColW, margin, bottomY, freq, 4);

  // Barra de seção principal
  y = sectionBar(doc, "Prescrição 5-3-1", `TM ${data.percentual_training_max}% · 4 semanas`, mainX, y, mainW);

  // ============================================================
  // AQUECIMENTO — tabela única com célula mesclada de grupo
  // ============================================================
  const aq = data.aquecimento;
  const aqBlocos: AquecimentoBloco[] = ["LIB", "MOB", "ATI", "PREV"];
  const gruposAtivos = aq
    ? aqBlocos.filter((k) => (aq[k]?.length ?? 0) > 0)
    : [];

  if (aq && gruposAtivos.length > 0) {
    // Monta lista plana de linhas + índices onde inicia cada grupo (para desenhar rowSpan).
    type AqRow = { grupo: AquecimentoBloco; ex: PersonalizadoAquecimentoEx };
    const rows: AqRow[] = [];
    const grupoStart: { grupo: AquecimentoBloco; startIdx: number; count: number }[] = [];
    gruposAtivos.forEach((g) => {
      const items = aq[g]!;
      grupoStart.push({ grupo: g, startIdx: rows.length, count: items.length });
      items.forEach((ex) => rows.push({ grupo: g, ex }));
    });

    const body = rows.map((r, idx) => {
      const info = grupoStart.find((gs) => gs.startIdx === idx);
      const cells: (string | { content: string; rowSpan?: number; styles?: Record<string, unknown> })[] = [];
      if (info) {
        // Letras empilhadas do grupo (ex.: "L\nI\nB").
        const stacked = info.grupo.split("").join("\n");
        cells.push({
          content: stacked,
          rowSpan: info.count,
          styles: {
            valign: "middle",
            halign: "center",
            fontStyle: "bold",
            fillColor: INK,
            textColor: WHITE,
            fontSize: 9,
            cellPadding: { top: 1, bottom: 1, left: 0.5, right: 0.5 },
          },
        });
      }
      cells.push(cleanName(r.ex.exercicio) || "—");
      diasHeader.forEach((d) => {
        cells.push(r.ex.dias?.includes(d) ? CHECK : "");
      });
      cells.push(String(r.ex.repeticoes ?? ""));
      cells.push(""); // KG sempre vazio no aquecimento
      return cells;
    });

    const wGrupo = 9;
    const wT = 8;
    const wRep = 14;
    const wKg = 16;
    const wEx = mainW - (wGrupo + wT * freq + wRep + wKg);

    const colStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wGrupo, halign: "center", valign: "middle" },
      1: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold" },
    };
    for (let i = 0; i < freq; i++) {
      colStyles[2 + i] = { cellWidth: wT, halign: "center" };
    }
    colStyles[2 + freq] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };
    colStyles[3 + freq] = { cellWidth: wKg, halign: "right", textColor: INK_MUTED };

    const head = [[
      { content: "", styles: { halign: "center" as const } },
      { content: "EXERCÍCIOS", styles: { halign: "left" as const } },
      ...diasHeader.map((d) => ({ content: d, styles: { halign: "center" as const } })),
      { content: "REP.", styles: { halign: "right" as const } },
      { content: "KG", styles: { halign: "right" as const } },
    ]];

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      head,
      body,
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.1, right: 1.1 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: { bottom: 0.08 } as unknown as number,
        overflow: "ellipsize",
      },
      headStyles: {
        fillColor: WHITE,
        textColor: INK,
        fontStyle: "bold",
        fontSize: 6.8,
        lineWidth: { bottom: 0.26 } as unknown as number,
        lineColor: INK,
      },
      columnStyles: colStyles,
      didParseCell: (hd) => {
        if (hd.section === "body" && hd.column.index >= 2 && hd.column.index < 2 + freq) {
          if (hd.cell.text?.[0] === CHECK) hd.cell.text = [""];
        }
      },
      didDrawCell: (hd) => {
        if (hd.section === "body" && hd.column.index >= 2 && hd.column.index < 2 + freq) {
          const row = rows[hd.row.index];
          const tKey = `T${hd.column.index - 2 + 1}`;
          if (row?.ex.dias?.includes(tKey)) {
            const cx = hd.cell.x + hd.cell.width / 2;
            const cy = hd.cell.y + hd.cell.height / 2;
            doc.setFillColor(...RED_SOFT);
            doc.circle(cx, cy, 1.0, "F");
          }
          if (hd.column.index > 2) {
            const x = hd.cell.x;
            doc.setDrawColor(...RULE);
            doc.setLineWidth(0.15);
            doc.line(x, hd.cell.y + 0.4, x, hd.cell.y + hd.cell.height - 0.4);
          }
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  // ============================================================
  // FORÇA — tabela unificada, todos os levantamentos lado a lado
  // ============================================================
  const allLifts = data.dias.flatMap((d) => d.levantamentos);
  const ensureSpace = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = drawHeader(doc, student, mainX, mainW, margin);
      drawFrequenciaColumn(doc, freqX, freqColW, margin, bottomY, freq, 4);
    }
  };

  if (allLifts.length > 0) {
    ensureSpace(30);

    const nLifts = allLifts.length;
    const wPctLabel = 16;
    const perLift = (mainW - wPctLabel) / nLifts;
    const wReps = perLift * 0.42;
    const wKg = perLift - wReps;

    // Waves para cada levantamento (4 semanas × 6 séries).
    const waves = allLifts.map((l) => computeWave(l.rm_1, data.percentual_training_max));

    type Cell = string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };
    const body: Cell[][] = [];

    // --- Header 1: barra vermelha com nome de cada levantamento (colSpan=2 por lift) ---
    body.push([
      { content: "", styles: { fillColor: RED } },
      ...allLifts.flatMap((l) => [
        {
          content: l.levantamento.toUpperCase(),
          colSpan: 2,
          styles: {
            fillColor: RED,
            textColor: WHITE,
            fontStyle: "bold",
            halign: "center" as const,
            fontSize: 8.5,
          },
        },
      ] as Cell[]),
    ]);

    // --- Header 2: 1RM ---
    body.push([
      { content: "1RM", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "left", fontSize: 7 } },
      ...allLifts.flatMap((l) => [
        {
          content: `${l.rm_1} kg`,
          colSpan: 2,
          styles: { fillColor: SURFACE, halign: "center" as const, fontSize: 8, fontStyle: "bold" },
        },
      ] as Cell[]),
    ]);

    // --- Header 3: TM ---
    body.push([
      { content: "TM", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "left", fontSize: 7, textColor: RED } },
      ...allLifts.flatMap((l) => [
        {
          content: `${roundToNearest2_5(trainingMax(l.rm_1, data.percentual_training_max))} kg`,
          colSpan: 2,
          styles: { fillColor: SURFACE, halign: "center" as const, fontSize: 8, fontStyle: "bold", textColor: RED },
        },
      ] as Cell[]),
    ]);

    // Para cada semana: barra preta + sub-header REPS/KG + 6 linhas de dados
    for (let semanaIdx = 0; semanaIdx < 4; semanaIdx++) {
      const isDeload = semanaIdx === 3;
      const label = isDeload ? "SEMANA 4 · DELOAD" : `SEMANA ${semanaIdx + 1}`;
      body.push([
        {
          content: label,
          colSpan: 1 + nLifts * 2,
          styles: {
            fillColor: INK,
            textColor: WHITE,
            fontStyle: "bold",
            halign: "left" as const,
            fontSize: 8,
          },
        },
      ]);
      body.push([
        { content: "%", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center", fontSize: 6.6 } },
        ...allLifts.flatMap(() => [
          { content: "REPS", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center" as const, fontSize: 6.6 } },
          { content: "KG", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center" as const, fontSize: 6.6 } },
        ] as Cell[]),
      ]);

      const numSeries = waves[0]?.[semanaIdx]?.series.length ?? 6;
      for (let sIdx = 0; sIdx < numSeries; sIdx++) {
        const ref = waves[0][semanaIdx].series[sIdx];
        const isLast = sIdx === numSeries - 1;
        let tint: [number, number, number];
        if (isDeload) tint = AQUEC_TINT;
        else if (ref.tipo === "aquecimento") tint = AQUEC_TINT;
        else if (isLast) tint = AMRAP_TINT;
        else tint = TRAB_TINT;

        body.push([
          {
            content: `${ref.pct}%`,
            styles: { fillColor: tint, fontStyle: "bold", halign: "center", fontSize: 7.5, textColor: INK },
          },
          ...allLifts.flatMap((_, liftIdx) => {
            const s = waves[liftIdx][semanaIdx].series[sIdx];
            return [
              {
                content: s?.reps ?? "",
                styles: { fillColor: tint, halign: "center" as const, fontSize: 8, fontStyle: "bold" },
              },
              {
                content: s ? `${s.kg}` : "",
                styles: { fillColor: tint, halign: "center" as const, fontSize: 8, fontStyle: "bold" },
              },
            ] as Cell[];
          }),
        ]);
      }
    }

    const forcaColStyles: Record<number, Record<string, unknown>> = {
      0: { cellWidth: wPctLabel },
    };
    for (let i = 0; i < nLifts; i++) {
      forcaColStyles[1 + i * 2] = { cellWidth: wReps };
      forcaColStyles[2 + i * 2] = { cellWidth: wKg };
    }

    autoTable(doc, {
      startY: y,
      margin: { left: mainX, right: pageW - (mainX + mainW) },
      tableWidth: mainW,
      theme: "plain",
      body,
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 },
        textColor: INK,
        lineColor: RULE,
        lineWidth: 0.05,
        overflow: "ellipsize",
      },
      columnStyles: forcaColStyles,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  // ============================================================
  // PÁGINA 2 — ACESSÓRIOS + AUXILIARES
  // ============================================================
  doc.addPage();
  y = drawHeader(doc, student, "5-3-1 · ACESSÓRIOS & AUXILIARES", mainX, mainW, margin);

  data.dias.forEach((dia) => {
    ensureSpace(20);
    y = sectionBar(doc, diaTitulo(dia), undefined, mainX, y, mainW);

    // Acessórios — uma seção por levantamento vinculado.
    if (dia.acessorios.length === 0 && dia.auxiliares.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sem acessórios nem auxiliares.", mainX + 1, y + 3);
      y += 6;
      return;
    }

    if (dia.acessorios.length > 0) {
      // Sub-título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text("ACESSÓRIOS", mainX, y + 3);
      y += 4.6;

      // Group by vinculado_a
      const grupos = new Map<string, typeof dia.acessorios>();
      dia.acessorios.forEach((a) => {
        const arr = grupos.get(a.vinculado_a) ?? [];
        arr.push(a);
        grupos.set(a.vinculado_a, arr);
      });

      grupos.forEach((accs, vinc) => {
        const rmVinculado =
          dia.levantamentos.find((l) => l.levantamento === vinc)?.rm_1 ?? 0;

        const body: string[][] = [];
        accs.forEach((acc) => {
          acc.semanas.forEach((s) => {
            const kg = acessorioKg(rmVinculado, data.percentual_training_max, s.percentual);
            body.push([
              `S${s.semana}`,
              cleanName(acc.exercicio) || "—",
              String(s.series),
              s.reps,
              `${s.percentual}%`,
              kg > 0 ? `${kg}kg` : "—",
            ]);
          });
        });

        ensureSpace(body.length * 4 + 10);
        autoTable(doc, {
          startY: y,
          margin: { left: mainX, right: pageW - (mainX + mainW) },
          tableWidth: mainW,
          theme: "plain",
          head: [[
            { content: `VINCULADO A: ${vinc.toUpperCase()}`, colSpan: 6, styles: { halign: "left" as const, fillColor: SURFACE, textColor: INK, fontSize: 7 } },
          ], [
            { content: "SEM", styles: { halign: "center" as const } },
            { content: "EXERCÍCIO", styles: { halign: "left" as const } },
            { content: "SÉRIES", styles: { halign: "center" as const } },
            { content: "REPS", styles: { halign: "center" as const } },
            { content: "%", styles: { halign: "center" as const } },
            { content: "KG", styles: { halign: "right" as const } },
          ]],
          body,
          styles: {
            fontSize: 8,
            cellPadding: { top: 1.0, bottom: 1.0, left: 1.4, right: 1.4 },
            textColor: INK,
            lineColor: RULE,
            lineWidth: 0,
          },
          headStyles: {
            fillColor: WHITE,
            textColor: INK,
            fontStyle: "bold",
            fontSize: 6.8,
            lineWidth: { bottom: 0.26 },
            lineColor: INK,
          },
          columnStyles: {
            0: { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: RED_SOFT },
            1: { fontStyle: "bold" },
            2: { cellWidth: 18, halign: "center" },
            3: { cellWidth: 22, halign: "center" },
            4: { cellWidth: 16, halign: "center" },
            5: { cellWidth: 18, halign: "right", fontStyle: "bold" },
          },
          didParseCell: (hd) => {
            if (hd.section === "body") {
              hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.08, left: 0 } as unknown as number;
              hd.cell.styles.lineColor = RULE;
            }
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.8;
      });
    }

    if (dia.auxiliares.length > 0) {
      ensureSpace(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text("AUXILIARES", mainX, y + 3);
      y += 4.6;

      const body = dia.auxiliares.map((a) => [
        cleanName(a.exercicio) || "—",
        String(a.series ?? ""),
        a.reps ?? "",
        a.kg ?? "",
      ]);

      ensureSpace(body.length * 4 + 8);
      autoTable(doc, {
        startY: y,
        margin: { left: mainX, right: pageW - (mainX + mainW) },
        tableWidth: mainW,
        theme: "plain",
        head: [[
          { content: "EXERCÍCIO", styles: { halign: "left" as const } },
          { content: "SÉRIES", styles: { halign: "center" as const } },
          { content: "REPS", styles: { halign: "center" as const } },
          { content: "KG", styles: { halign: "right" as const } },
        ]],
        body,
        styles: {
          fontSize: 8,
          cellPadding: { top: 1.0, bottom: 1.0, left: 1.4, right: 1.4 },
          textColor: INK,
          lineColor: RULE,
          lineWidth: 0,
        },
        headStyles: {
          fillColor: WHITE,
          textColor: INK,
          fontStyle: "bold",
          fontSize: 6.8,
          lineWidth: { bottom: 0.26 },
          lineColor: INK,
        },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 26, halign: "center" },
          3: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (hd) => {
          if (hd.section === "body") {
            hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.08, left: 0 } as unknown as number;
            hd.cell.styles.lineColor = RULE;
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2.4;
    }

    y += 1;
  });

  // ============================================================
  // OUTPUT
  // ============================================================
  const safeName = student.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `treino-531-${safeName}.pdf`;

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(filename);
  }
}
