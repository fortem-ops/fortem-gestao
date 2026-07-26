import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import fortemLogo from "@/assets/fortem-logo-pdf.png";
import {
  type Wendler531Conteudo,
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

const AQUEC_TINT: [number, number, number] = [220, 240, 220];
const TRAB_TINT: [number, number, number] = [253, 214, 214];
const AMRAP_TINT: [number, number, number] = [248, 160, 160];

const AQ_LABELS: Record<AquecimentoBloco, string> = {
  LIB: "LIBERAÇÃO",
  MOB: "MOBILIDADE",
  ATI: "ATIVAÇÃO",
  PREV: "PREVENTIVOS",
};

function drawHeader(
  doc: jsPDF,
  student: Tables<"alunos">,
  mainX: number,
  mainW: number,
  margin: number,
): number {
  // Logo — topo ESQUERDO.
  try {
    const LOGO_H = 8;
    const LOGO_RATIO = 1920 / 357;
    const LOGO_W = LOGO_H * LOGO_RATIO;
    doc.addImage(fortemLogo, "PNG", mainX, margin + 1, LOGO_W, LOGO_H);
  } catch {
    // ignore
  }

  // Bloco do aluno — topo DIREITO.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text("ALUNO", mainX + mainW, margin + 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(student.nome.toUpperCase(), mainX + mainW, margin + 9, { align: "right" });

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_SOFT);
  doc.text(`TREINO 5-3-1  ·  ${today}`, mainX + mainW, margin + 14, { align: "right" });

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(mainX, margin + 20, mainX + mainW, margin + 20);

  return margin + 20 + 3;
}

function sectionBar(
  doc: jsPDF,
  label: string,
  meta: string | undefined,
  x: number,
  y: number,
  w: number,
  h = 6.4,
): number {
  doc.setFillColor(...RED);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(label.toUpperCase(), x + 2.4, y + h / 2 + 1.1);
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(meta, x + w - 2, y + h / 2 + 1.1, { align: "right" });
  }
  return y + h + 1.2;
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
  const freq = data.frequencia;
  const diasHeader = Array.from({ length: freq }, (_, i) => `T${i + 1}`);
  const aq = data.aquecimento;
  const aqBlocos: AquecimentoBloco[] = ["LIB", "MOB", "ATI", "PREV"];
  const gruposAtivos = aq
    ? aqBlocos.filter((k) => (aq[k]?.length ?? 0) > 0)
    : [];
  const allLifts = data.dias.flatMap((d) => d.levantamentos);

  // ============================================================
  // Auto-fit loop — retry página 1 até caber em uma única página.
  // ============================================================
  const MAX_ATTEMPTS = 14;
  let scale = 1.0;
  let doc!: jsPDF;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const gutter = 4;
    const freqColW = 22;
    const mainX = margin;
    const mainW = pageW - margin * 2 - freqColW - gutter;
    const freqX = mainX + mainW + gutter;
    const bottomY = pageH - margin;

    // Escalares dependentes do fit.
    const S = scale;
    const ROW_FONT = Math.max(5.5, 8 * S);
    const HEAD_FONT = Math.max(4.6, 6.8 * S);
    const ROW_PAD = Math.max(0.28, 1.2 * S);
    const HEAD_PAD = Math.max(0.22, 1.0 * S);
    const SIDE_PAD = Math.max(0.5, 1.1 * S);
    const AQ_SUBBAR_H = Math.max(3.6, 5.4 * S);
    const AQ_BADGE_FONT = Math.max(5.5, 7.5 * S);
    const AQ_LABEL_FONT = Math.max(5.8, 7.8 * S);
    const FORCA_HEADER_FONT = Math.max(6.0, 8.5 * S);
    const FORCA_ROW_FONT = Math.max(5.4, 8 * S);
    const FORCA_PAD = Math.max(0.32, 1.1 * S);

    let y = drawHeader(doc, student, mainX, mainW, margin);
    drawFrequenciaColumn(doc, freqX, freqColW, margin, bottomY, freq, 4);

    // ============================================================
    // OBSERVAÇÕES — título + linhas em branco pra anotação manual
    // ============================================================
    {
      const OBS_TITLE_FONT = Math.max(6.4, 8.4 * S);
      const OBS_LINE_GAP = Math.max(3.0, 4.4 * S);
      const OBS_LINES = 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(OBS_TITLE_FONT);
      doc.setTextColor(...INK);
      doc.text("OBSERVAÇÕES", mainX, y + OBS_TITLE_FONT * 0.35);
      let lineY = y + OBS_TITLE_FONT * 0.35 + OBS_LINE_GAP;
      doc.setDrawColor(...INK_MUTED);
      doc.setLineWidth(0.15);
      for (let i = 0; i < OBS_LINES; i++) {
        doc.line(mainX, lineY, mainX + mainW, lineY);
        lineY += OBS_LINE_GAP;
      }
      y = lineY - OBS_LINE_GAP + Math.max(1.2, 2.0 * S);
    }


    // ============================================================
    // AQUECIMENTO — barra vermelha "AQUECIMENTO" + sub-blocos
    // ============================================================
    if (aq && gruposAtivos.length > 0) {
      y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW, Math.max(5.2, 6.4 * S));

      const wNum = Math.max(5, 6.4 * S);
      const wCat = Math.max(18, 22 * S);
      const wT = Math.max(6, 8 * S);
      const wRep = Math.max(10, 14 * S);
      const wKg = Math.max(12, 16 * S);
      const wEx = mainW - (wNum + wCat + wT * freq + wRep + wKg);
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
      for (let i = 0; i < freq; i++) {
        colStyles[3 + i] = { cellWidth: wT, halign: "center" };
      }
      colStyles[3 + freq] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };
      colStyles[4 + freq] = { cellWidth: wKg, halign: "right", textColor: INK_MUTED };

      gruposAtivos.forEach((g) => {
        const items = aq[g]!;

        // Sub-barra: badge preto (sigla) + faixa branca (nome completo).
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
          diasHeader.forEach((d) => cells.push(ex.dias?.includes(d) ? CHECK : ""));
          cells.push(String(ex.repeticoes ?? ""));
          cells.push("");
          return cells;
        });

        const head = [[
          { content: "#", styles: { halign: "center" as const } },
          { content: "CAT", styles: { halign: "center" as const } },
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
              // Divisória mais grossa/escura entre exercícios.
              hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.25, left: 0 } as unknown as number;
              hd.cell.styles.lineColor = INK_SOFT;
              if (hd.column.index >= 3 && hd.column.index < 3 + freq) {
                if (hd.cell.text?.[0] === CHECK) hd.cell.text = [""];
              }
            }
          },
          didDrawCell: (hd) => {
            if (hd.section === "body" && hd.column.index >= 3 && hd.column.index < 3 + freq) {
              const row = items[hd.row.index];
              const tKey = `T${hd.column.index - 3 + 1}`;
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
    // FORÇA — tabela unificada
    // ============================================================
    if (allLifts.length > 0) {
      const nLifts = allLifts.length;
      const wPctLabel = Math.max(12, 16 * S);
      const perLift = (mainW - wPctLabel) / nLifts;
      const wReps = perLift * 0.42;
      const wKg = perLift - wReps;

      const waves = allLifts.map((l) => computeWave(l.rm_1, data.percentual_training_max));

      type Cell = string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };
      const body: Cell[][] = [];

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
              fontSize: FORCA_HEADER_FONT,
            },
          },
        ] as Cell[]),
      ]);

      body.push([
        { content: "1RM", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "left", fontSize: Math.max(5.4, 7 * S) } },
        ...allLifts.flatMap((l) => [
          {
            content: `${l.rm_1} kg`,
            colSpan: 2,
            styles: { fillColor: SURFACE, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold" },
          },
        ] as Cell[]),
      ]);

      body.push([
        { content: "TM", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "left", fontSize: Math.max(5.4, 7 * S), textColor: RED } },
        ...allLifts.flatMap((l) => [
          {
            content: `${roundToNearest2_5(trainingMax(l.rm_1, data.percentual_training_max))} kg`,
            colSpan: 2,
            styles: { fillColor: SURFACE, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold", textColor: RED },
          },
        ] as Cell[]),
      ]);

      // Bloco AQUECIMENTO compartilhado (uma vez só, aplica-se às 4 semanas).
      const warmupRef = waves[0]?.[0]?.series.filter((s) => s.tipo === "aquecimento") ?? [];
      if (warmupRef.length > 0) {
        body.push([
          {
            content: "AQUECIMENTO",
            colSpan: 1 + nLifts * 2,
            styles: {
              fillColor: INK,
              textColor: WHITE,
              fontStyle: "bold",
              halign: "left" as const,
              fontSize: Math.max(5.8, 8 * S),
            },
          },
        ]);
        body.push([
          { content: "%", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center", fontSize: Math.max(5.0, 6.6 * S) } },
          ...allLifts.flatMap(() => [
            { content: "REPS", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center" as const, fontSize: Math.max(5.0, 6.6 * S) } },
            { content: "KG", styles: { fillColor: SURFACE, fontStyle: "bold", halign: "center" as const, fontSize: Math.max(5.0, 6.6 * S) } },
          ] as Cell[]),
        ]);
        warmupRef.forEach((ref, sIdx) => {
          body.push([
            {
              content: `${ref.pct}%`,
              styles: { fillColor: AQUEC_TINT, fontStyle: "bold", halign: "center", fontSize: Math.max(5.4, 7.5 * S), textColor: INK },
            },
            ...allLifts.flatMap((_, liftIdx) => {
              const s = waves[liftIdx][0].series.filter((x) => x.tipo === "aquecimento")[sIdx];
              return [
                { content: s?.reps ?? "", styles: { fillColor: AQUEC_TINT, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold" } },
                { content: s ? `${s.kg}` : "", styles: { fillColor: AQUEC_TINT, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold" } },
              ] as Cell[];
            }),
          ]);
        });
      }

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
              fontSize: Math.max(5.8, 8 * S),
            },
          },
        ]);

        // Índices das séries de TRABALHO desta semana (pula as compartilhadas 40/50/60).
        // - Weeks 1-3: filtra tipo === "trabalho".
        // - Deload: DELOAD é tudo "trabalho"; pula as 3 primeiras (que batem com 40/50/60).
        const refSeries = waves[0][semanaIdx].series;
        const workIdx: number[] = isDeload
          ? refSeries.map((_, i) => i).filter((i) => i >= warmupRef.length)
          : refSeries.map((s, i) => (s.tipo === "trabalho" ? i : -1)).filter((i) => i >= 0);

        workIdx.forEach((sIdx, rowIdx) => {
          const ref = refSeries[sIdx];
          const isLast = rowIdx === workIdx.length - 1;
          const tint: [number, number, number] = isDeload
            ? AQUEC_TINT
            : isLast
              ? AMRAP_TINT
              : TRAB_TINT;

          body.push([
            {
              content: `${ref.pct}%`,
              styles: { fillColor: tint, fontStyle: "bold", halign: "center", fontSize: Math.max(5.4, 7.5 * S), textColor: INK },
            },
            ...allLifts.flatMap((_, liftIdx) => {
              const s = waves[liftIdx][semanaIdx].series[sIdx];
              return [
                { content: s?.reps ?? "", styles: { fillColor: tint, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold" } },
                { content: s ? `${s.kg}` : "", styles: { fillColor: tint, halign: "center" as const, fontSize: FORCA_ROW_FONT, fontStyle: "bold" } },
              ] as Cell[];
            }),
          ]);
        });
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
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        body,
        styles: {
          fontSize: FORCA_ROW_FONT,
          cellPadding: { top: FORCA_PAD, bottom: FORCA_PAD, left: SIDE_PAD, right: SIDE_PAD },
          textColor: INK,
          lineColor: RULE,
          lineWidth: 0.05,
          overflow: "ellipsize",
          minCellHeight: 0,
        },
        columnStyles: forcaColStyles,
        didDrawCell: (hd) => {
          // Divisórias verticais grossas entre levantamentos, valem para
          // todas as linhas — incluindo cabeçalhos com colSpan (que aparecem
          // apenas na coluna 0). Desenhamos ao longo de toda a altura da linha.
          if (hd.column.index !== 0) return;
          doc.setDrawColor(...INK);
          doc.setLineWidth(0.5);
          for (let k = 1; k < nLifts; k++) {
            const lineX = mainX + wPctLabel + k * (wReps + wKg);
            doc.line(lineX, hd.cell.y, lineX, hd.cell.y + hd.cell.height);
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
    }

    // Se ainda estamos numa única página, sucesso.
    if (doc.getNumberOfPages() === 1) break;
    // Caso contrário, reduz e tenta de novo.
    scale *= 0.92;
  }

  // ============================================================
  // PÁGINA 2 — ACESSÓRIOS + AUXILIARES
  // ============================================================
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const gutter = 4;
  const freqColW = 22;
  const mainX = margin;
  const mainW = pageW - margin * 2 - freqColW - gutter;
  const freqX = mainX + mainW + gutter;
  const bottomY = pageH - margin;

  doc.addPage();
  let y = drawHeader(doc, student, mainX, mainW, margin);

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = drawHeader(doc, student, mainX, mainW, margin);
      drawFrequenciaColumn(doc, freqX, freqColW, margin, bottomY, data.frequencia, 4);
    }
  };

  const diaTitulo = (d: typeof data.dias[number]) => {
    const nomes = d.levantamentos.map((l) => l.levantamento.toUpperCase()).join(" + ");
    return `TREINO ${d.ordem}${nomes ? " · " + nomes : ""}`;
  };

  data.dias.forEach((dia) => {
    ensureSpace(20);
    y = sectionBar(doc, diaTitulo(dia), undefined, mainX, y, mainW);

    if (dia.acessorios.length === 0 && dia.auxiliares.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sem acessórios nem auxiliares.", mainX + 1, y + 3);
      y += 6;
      return;
    }

    if (dia.acessorios.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text("ACESSÓRIOS", mainX, y + 3);
      y += 4.6;

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
