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

const AQ_LABEL: Record<AquecimentoBloco, string> = {
  LIB: "LIBERAÇÃO",
  MOB: "MOBILIDADE",
  ATI: "ATIVAÇÃO",
  PREV: "PREVENTIVOS",
};

const cleanName = (s?: string | null) =>
  (s ?? "").replace(/^\s*\d+\s*[-–—.)]\s*/, "").trim();

function drawHeader(
  doc: jsPDF,
  student: Tables<"alunos">,
  subtitle: string,
  mainX: number,
  mainW: number,
  margin: number,
): number {
  const headerH = 20;
  try {
    const LOGO_H = 8;
    const LOGO_RATIO = 1920 / 357;
    doc.addImage(fortemLogo, "PNG", mainX, margin + 1, LOGO_H * LOGO_RATIO, LOGO_H);
  } catch {
    // ignore
  }

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
  doc.text(`${subtitle}  ·  ${today}`, mainX + mainW, margin + 14, { align: "right" });

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(mainX, margin + headerH, mainX + mainW, margin + headerH);

  return margin + headerH + 3;
}

function sectionBar(
  doc: jsPDF,
  label: string,
  meta: string | undefined,
  x: number,
  y: number,
  w: number,
): number {
  const H = 6.2;
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

export async function exportWendler531PDF({
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

  const freq = data.frequencia;
  const diasHeader = Array.from({ length: freq }, (_, i) => `T${i + 1}`);

  let y = drawHeader(doc, student, "5-3-1 · ONDA DE 4 SEMANAS", mainX, mainW, margin);

  // ============================================================
  // AQUECIMENTO
  // ============================================================
  const aq = data.aquecimento;
  const aqBlocos: AquecimentoBloco[] = ["LIB", "MOB", "ATI", "PREV"];
  const hasAq = aq && aqBlocos.some((k) => (aq[k]?.length ?? 0) > 0);

  if (hasAq && aq) {
    y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW);

    aqBlocos
      .filter((k) => (aq[k]?.length ?? 0) > 0)
      .forEach((k) => {
        const items = aq[k]!;
        const BADGE_H = 4.8;
        const badgeW = 15;
        doc.setFillColor(...INK);
        doc.rect(mainX, y, badgeW, BADGE_H, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        doc.text(k, mainX + badgeW / 2, y + BADGE_H / 2 + 0.9, { align: "center" });
        doc.setTextColor(...INK);
        doc.setFontSize(8);
        doc.text(AQ_LABEL[k], mainX + badgeW + 2, y + BADGE_H / 2 + 0.9);
        y += BADGE_H + 0.6;

        const head = [
          [
            { content: "#", styles: { halign: "center" as const } },
            { content: "EXERCÍCIO", styles: { halign: "left" as const } },
            ...diasHeader.map((d) => ({ content: d, styles: { halign: "center" as const } })),
            { content: "REP", styles: { halign: "right" as const } },
          ],
        ];

        const body = items.map((ex: PersonalizadoAquecimentoEx, i) => {
          const row: (string)[] = [
            String(i + 1),
            cleanName(ex.exercicio) || "—",
          ];
          diasHeader.forEach((d) => {
            row.push(ex.dias?.includes(d) ? CHECK : "");
          });
          row.push(String(ex.repeticoes ?? ""));
          return row;
        });

        const wNum = 6, wT = 8, wRep = 14;
        const wEx = mainW - (wNum + wT * freq + wRep);
        const colStyles: Record<number, Record<string, unknown>> = {
          0: { cellWidth: wNum, halign: "center", textColor: INK_SOFT, fontStyle: "bold" },
          1: { cellWidth: wEx, overflow: "ellipsize", fontStyle: "bold" },
        };
        for (let i = 0; i < freq; i++) {
          colStyles[2 + i] = { cellWidth: wT, halign: "center" };
        }
        colStyles[2 + freq] = { cellWidth: wRep, halign: "right", fontStyle: "bold", textColor: INK_SOFT };

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
            lineWidth: 0,
            overflow: "ellipsize",
          },
          headStyles: {
            fillColor: WHITE,
            textColor: INK,
            fontStyle: "bold",
            fontSize: 6.8,
            lineWidth: { bottom: 0.26 },
            lineColor: INK,
          },
          alternateRowStyles: { fillColor: SURFACE },
          columnStyles: colStyles,
          didParseCell: (hd) => {
            if (hd.section === "body" && hd.column.index >= 2 && hd.column.index < 2 + freq) {
              if (hd.cell.text?.[0] === CHECK) hd.cell.text = [""];
            }
          },
          didDrawCell: (hd) => {
            if (hd.column.index >= 2 && hd.column.index < 2 + freq) {
              if (hd.column.index > 2) {
                const x = hd.cell.x;
                doc.setDrawColor(...RULE);
                doc.setLineWidth(0.15);
                doc.line(x, hd.cell.y + 0.4, x, hd.cell.y + hd.cell.height - 0.4);
              }
              if (hd.section === "body") {
                const ex = items[hd.row.index];
                const tKey = `T${hd.column.index - 2 + 1}`;
                if (ex?.dias?.includes(tKey)) {
                  const cx = hd.cell.x + hd.cell.width / 2;
                  const cy = hd.cell.y + hd.cell.height / 2;
                  doc.setFillColor(...RED_SOFT);
                  doc.circle(cx, cy, 1.0, "F");
                }
              }
            }
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.4;
      });

    y += 1;
  }

  // ============================================================
  // DIAS — força (levantamentos + ondas)
  // ============================================================
  const ensureSpace = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = drawHeader(doc, student, "5-3-1 · ONDA DE 4 SEMANAS", mainX, mainW, margin);
    }
  };

  const diaTitulo = (d: typeof data.dias[number]) => {
    const nomes = d.levantamentos.map((l) => l.levantamento.toUpperCase()).join(" + ");
    return `TREINO ${d.ordem}${nomes ? " · " + nomes : ""}`;
  };

  data.dias.forEach((dia) => {
    ensureSpace(20);
    y = sectionBar(doc, diaTitulo(dia), undefined, mainX, y, mainW);

    if (dia.levantamentos.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sem levantamentos principais neste dia.", mainX + 1, y + 3);
      y += 6;
      return;
    }

    dia.levantamentos.forEach((lev) => {
      const base = LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento];
      const tm = roundToNearest2_5(trainingMax(lev.rm_1, data.percentual_training_max));

      ensureSpace(10);
      // Cabeçalho do levantamento
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(`${lev.levantamento.toUpperCase()} — ${base?.nome ?? ""}`, mainX, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...RED_SOFT);
      doc.text(`TM: ${tm}kg  ·  1RM: ${lev.rm_1}kg`, mainX + mainW, y + 3, { align: "right" });
      y += 5;

      const wave = computeWave(lev.rm_1, data.percentual_training_max);
      // Tabela: linhas = séries, agrupadas por semana via coluna SEMANA.
      const body: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = [];
      wave.forEach((sem) => {
        body.push([
          {
            content: sem.semana === 4 ? "SEMANA 4 · DELOAD" : `SEMANA ${sem.semana}`,
            colSpan: 4,
            styles: {
              fillColor: RED_TINT,
              textColor: RED,
              fontStyle: "bold",
              halign: "left",
              fontSize: 7.2,
            },
          },
        ]);
        sem.series.forEach((s) => {
          body.push([
            s.tipo === "aquecimento" ? "aquec." : "trab.",
            `${s.pct}%`,
            s.reps,
            `${s.kg}kg`,
          ]);
        });
      });

      ensureSpace(Math.min(60, body.length * 4 + 6));
      autoTable(doc, {
        startY: y,
        margin: { left: mainX, right: pageW - (mainX + mainW) },
        tableWidth: mainW,
        theme: "plain",
        head: [[
          { content: "TIPO", styles: { halign: "left" as const } },
          { content: "%", styles: { halign: "center" as const } },
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
          0: { cellWidth: 30, textColor: INK_SOFT, fontStyle: "bold" },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
          3: { halign: "right", fontStyle: "bold" },
        },
        didParseCell: (hd) => {
          if (hd.section === "body") {
            hd.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.08, left: 0 } as unknown as number;
            hd.cell.styles.lineColor = RULE;
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2.4;
    });

    y += 1.4;
  });

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
