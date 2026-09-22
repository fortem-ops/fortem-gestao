import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { aquecimentoLabel, ordenarBlocosAquecimento } from "@/lib/aquecimentoBlocos";
import type { Tables } from "@/integrations/supabase/types";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "./personalizadoTypes";
import type { MDAuxiliar, MDPlanoSemana } from "@/lib/mileDeepShared";
import { MD_TOTAL_SEMANAS } from "@/lib/mileDeepShared";
import {
  INK,
  INK_SOFT,
  INK_MUTED,
  SURFACE,
  WHITE,
  cleanName,
  drawWorkoutHeader,
  sectionBar,
  drawObservacoes,
} from "./pdfShared";

export interface MileDeepPdfLevantamento {
  /** Ex.: "Agachamento". */
  nome: string;
  /** Nome do exercício no banco. */
  base: string;
  /** Referência (1RM ou 5RM) em kg. */
  rm: number;
}

export interface MileDeepPdfSessao {
  slot: string;
  titulo: string;
  semana: number;
  plano: MDPlanoSemana;
  levantamentos: MileDeepPdfLevantamento[];
  auxiliares: MDAuxiliar[];
  /** 12 semanas daquela ordem de blocos. */
  tabela: MDPlanoSemana[];
}

export interface MileDeepPdfArgs {
  student: Tables<"alunos">;
  titulo: string;
  /** "1RM" ou "5RM". */
  refLabel: string;
  aquecimento?: Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
  observacoes?: string;
  sessoes: MileDeepPdfSessao[];
  nomeArquivo: string;
  print?: boolean;
}

const lastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export async function exportMileDeepPDF({
  student,
  titulo,
  refLabel,
  aquecimento,
  observacoes,
  sessoes,
  nomeArquivo,
  print,
}: MileDeepPdfArgs): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const mainX = margin;
  const mainW = pageW - margin * 2;
  const bottomY = pageH - margin;

  const commonStyles = {
    fontSize: 8,
    cellPadding: { top: 1.2, bottom: 1.2, left: 1.1, right: 1.1 },
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
    fontSize: 6.8,
    cellPadding: { top: 1, bottom: 1, left: 1.1, right: 1.1 },
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

  let y = drawWorkoutHeader(doc, student, mainX, mainW, margin, titulo.toUpperCase());
  y = drawObservacoes(doc, mainX, y, mainW, 1, 2);

  if (observacoes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...INK_SOFT);
    const linhas = doc.splitTextToSize(observacoes.trim(), mainW);
    doc.text(linhas, mainX, y + 2.4);
    y += 2.4 + linhas.length * 3.2;
  }

  const ensurePage = (needed: number) => {
    if (y + needed > bottomY) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Aquecimento ─────────────────────────────────────────────
  const gruposAtivos = aquecimento
    ? ordenarBlocosAquecimento(Object.keys(aquecimento)).filter(
        (k) => (aquecimento[k]?.length ?? 0) > 0,
      )
    : [];

  if (gruposAtivos.length > 0) {
    ensurePage(24);
    y = sectionBar(doc, "Aquecimento", undefined, mainX, y, mainW, 6.4);
    gruposAtivos.forEach((g) => {
      const items = aquecimento![g] ?? [];
      ensurePage(16);
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        tableWidth: mainW,
        theme: "plain",
        rowPageBreak: "avoid",
        head: [[
          { content: aquecimentoLabel(g).toUpperCase(), styles: { halign: "left" as const } },
          { content: "DIAS", styles: { halign: "center" as const } },
          { content: "REP.", styles: { halign: "right" as const } },
        ]],
        body: items.map((ex: PersonalizadoAquecimentoEx) => [
          cleanName(ex.exercicio) || "—",
          (ex.dias ?? []).join(" "),
          String(ex.repeticoes ?? ""),
        ]),
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: SURFACE },
        columnStyles: {
          0: { cellWidth: mainW - 56 },
          1: { cellWidth: 32, halign: "center" },
          2: { cellWidth: 24, halign: "right" },
        },
        didParseCell: bodyBorders,
      });
      y = lastY(doc) + 1.2;
    });
    y += 1;
  }

  // ── Sessões ─────────────────────────────────────────────────
  sessoes.forEach((s) => {
    ensurePage(40);
    y = sectionBar(
      doc,
      s.titulo,
      `${s.slot} · semana ${s.semana}/${MD_TOTAL_SEMANAS} · ${s.plano.bloco.label} · ${s.plano.esquema} · ${s.plano.faixaLabel} do ${refLabel}`,
      mainX,
      y,
      mainW,
      6.0,
    );

    const linhas: string[][] = s.levantamentos.map((l) => [
      "Principal",
      `${l.nome} — ${cleanName(l.base)}`,
      s.plano.esquema,
      `${s.plano.faixaLabel} do ${refLabel}${l.rm ? ` (${refLabel} ${l.rm} kg)` : ""}`,
    ]);
    s.auxiliares.forEach((aux, idx) => {
      linhas.push([
        `Auxiliar ${idx + 1} · ${aux.categoria || "—"}`,
        cleanName(aux.exercicio) || "—",
        `${aux.series}x${aux.reps}`,
        aux.kg ? `${aux.kg} kg` : "",
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
        { content: "CARGA", styles: { halign: "center" as const } },
      ]],
      body: linhas.length ? linhas : [["—", "Sem exercícios nesta sessão", "", ""]],
      styles: commonStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: "bold", textColor: INK_SOFT, overflow: "linebreak" },
        1: { cellWidth: mainW - 34 - 26 - 44 },
        2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 44, halign: "center" },
      },
      didParseCell: bodyBorders,
    });
    y = lastY(doc) + 2;
  });

  // ── Tabelas de referência (12 semanas por sessão) ───────────
  sessoes.forEach((s) => {
    ensurePage(70);
    y = sectionBar(
      doc,
      `Referência · ${s.titulo}`,
      `${MD_TOTAL_SEMANAS} semanas · % do ${refLabel}`,
      mainX,
      y,
      mainW,
      6.0,
    );
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      tableWidth: mainW,
      theme: "plain",
      rowPageBreak: "avoid",
      head: [[
        { content: "SEMANA", styles: { halign: "left" as const } },
        { content: "BLOCO", styles: { halign: "left" as const } },
        { content: "SÉRIES × REPS", styles: { halign: "center" as const } },
        { content: `FAIXA DE % DO ${refLabel}`, styles: { halign: "center" as const } },
      ]],
      body: s.tabela.map((l) => [
        `SEMANA ${l.semana}`,
        `${l.bloco.label} (mês ${l.mes})`,
        l.esquema,
        l.faixaLabel,
      ]),
      styles: commonStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: { fillColor: SURFACE },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold", textColor: INK_SOFT },
        1: { cellWidth: mainW - 30 - 36 - 44 },
        2: { cellWidth: 36, halign: "center" },
        3: { cellWidth: 44, halign: "center" },
      },
      didParseCell: bodyBorders,
    });
    y = lastY(doc) + 2;
  });

  ensurePage(8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text(
    `Sem cálculo de carga: use a faixa de % do ${refLabel} do bloco e autorregule com 1-2 repetições de reserva, anotando o peso usado. Depois da semana ${MD_TOTAL_SEMANAS} o ciclo reinicia na semana 1.`,
    mainX,
    y + 3,
    { maxWidth: mainW },
  );

  if (print) {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(nomeArquivo);
  }
}
