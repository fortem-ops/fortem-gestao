/**
 * Geração de PDF para o módulo Ponto.
 * Usa jsPDF + jspdf-autotable. Cores em RGB (jsPDF não aceita HSL diretamente).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMinutes } from "./ponto";
import { STATUS_PONTO_LABEL, type StatusPonto } from "./pontoTolerancia";

const FORTEM_GREEN: [number, number, number] = [34, 197, 94]; // primary
const FORTEM_DARK: [number, number, number] = [15, 17, 23];
const NOTA_LEGAL =
  "Cálculo conforme art. 58 §1º da CLT — tolerância de 5 minutos por marcação e até 10 minutos diários.";

function header(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setFillColor(...FORTEM_GREEN);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FORTEM — Gestão Técnica", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, doc.internal.pageSize.getWidth() - 14, 12, {
    align: "right",
  });

  doc.setTextColor(...FORTEM_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 14, 30);
  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitulo, 14, 37);
    doc.setTextColor(...FORTEM_DARK);
  }
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(NOTA_LEGAL, 14, h - 8);
    doc.text(`${i}/${pages}`, w - 14, h - 8, { align: "right" });
  }
}

export interface JornadaPdfRow {
  data: string; // YYYY-MM-DD
  prev_entrada?: string | null;
  prev_saida?: string | null;
  entrada?: string | null;
  intervalo_inicio?: string | null;
  intervalo_fim?: string | null;
  saida?: string | null;
  divergencia_entrada_min?: number | null;
  divergencia_intervalo_min?: number | null;
  divergencia_saida_min?: number | null;
  divergencia_total_dia?: number | null;
  minutos_tolerados?: number | null;
  minutos_considerados?: number | null;
  minutos_extras_validos?: number | null;
  minutos_descontaveis?: number | null;
  minutos_trabalhados?: number | null;
  status_ponto?: StatusPonto | null;
  tolerancia_excedida?: boolean | null;
}

const fHora = (ts?: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const fDiv = (m?: number | null) => (m == null ? "—" : `${m > 0 ? "+" : ""}${m}m`);

/** Espelho de ponto individual */
export function gerarEspelhoPonto(opts: {
  colaborador: string;
  cpf?: string;
  periodoInicio: string;
  periodoFim: string;
  jornadas: JornadaPdfRow[];
  saldoBancoMin?: number;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  header(
    doc,
    "Espelho de Ponto",
    `${opts.colaborador}${opts.cpf ? ` — CPF ${opts.cpf}` : ""} — ${new Date(
      opts.periodoInicio,
    ).toLocaleDateString("pt-BR")} a ${new Date(opts.periodoFim).toLocaleDateString("pt-BR")}`,
  );

  const body = opts.jornadas.map((j) => [
    new Date(j.data + "T00:00:00").toLocaleDateString("pt-BR"),
    fHora(j.prev_entrada),
    fHora(j.entrada),
    fHora(j.intervalo_inicio),
    fHora(j.intervalo_fim),
    fHora(j.saida),
    fDiv(j.divergencia_entrada_min),
    fDiv(j.divergencia_intervalo_min),
    fDiv(j.divergencia_saida_min),
    `${j.minutos_tolerados ?? 0}m`,
    `${j.minutos_considerados ?? 0}m`,
    formatMinutes(j.minutos_trabalhados),
    j.status_ponto ? STATUS_PONTO_LABEL[j.status_ponto] : "—",
  ]);

  autoTable(doc, {
    startY: 44,
    head: [
      [
        "Data",
        "Prev. Ent.",
        "Entrada",
        "Int. Início",
        "Int. Fim",
        "Saída",
        "Δ Entrada",
        "Δ Intervalo",
        "Δ Saída",
        "Tolerados",
        "Considerados",
        "Trabalhado",
        "Status",
      ],
    ],
    body,
    headStyles: { fillColor: FORTEM_GREEN, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 12) {
        const j = opts.jornadas[data.row.index];
        if (j?.tolerancia_excedida) data.cell.styles.textColor = [220, 38, 38];
        else if (j?.status_ponto === "hora_extra") data.cell.styles.textColor = [22, 163, 74];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const totConsiderados = opts.jornadas.reduce((s, j) => s + (j.minutos_considerados ?? 0), 0);
  const totExtras = opts.jornadas.reduce((s, j) => s + (j.minutos_extras_validos ?? 0), 0);
  const totDescontaveis = opts.jornadas.reduce((s, j) => s + (j.minutos_descontaveis ?? 0), 0);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Totais do período", 14, finalY);
  doc.setFont("helvetica", "normal");
  doc.text(`Considerados: ${totConsiderados} min`, 14, finalY + 6);
  doc.text(`Horas extras válidas: ${totExtras} min`, 80, finalY + 6);
  doc.text(`Descontáveis: ${totDescontaveis} min`, 160, finalY + 6);
  if (opts.saldoBancoMin != null) {
    doc.text(`Saldo banco de horas: ${formatMinutes(opts.saldoBancoMin)}`, 230, finalY + 6);
  }

  // Assinaturas
  const sigY = finalY + 28;
  doc.line(20, sigY, 110, sigY);
  doc.line(160, sigY, 250, sigY);
  doc.setFontSize(9);
  doc.text("Colaborador", 65, sigY + 5, { align: "center" });
  doc.text("Coordenação", 205, sigY + 5, { align: "center" });

  footer(doc);
  doc.save(`espelho-ponto_${opts.colaborador.replace(/\s+/g, "_")}_${opts.periodoInicio}_a_${opts.periodoFim}.pdf`);
}

export interface FechamentoPdfRow {
  nome: string;
  horas_previstas?: number | null;
  horas_trabalhadas?: number | null;
  extras?: number | null;
  descontaveis?: number | null;
  saldo_banco?: number | null;
  aprovado_por?: string | null;
  aprovado_em?: string | null;
}

export function gerarFechamentoMensal(opts: { mesReferencia: string; linhas: FechamentoPdfRow[] }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  header(doc, "Fechamento Mensal — Ponto", `Referência: ${opts.mesReferencia}`);

  autoTable(doc, {
    startY: 44,
    head: [["Profissional", "Previstas", "Trabalhadas", "Extras", "Descontáveis", "Saldo Banco", "Aprovação"]],
    body: opts.linhas.map((l) => [
      l.nome,
      formatMinutes(l.horas_previstas),
      formatMinutes(l.horas_trabalhadas),
      formatMinutes(l.extras),
      formatMinutes(l.descontaveis),
      formatMinutes(l.saldo_banco),
      l.aprovado_por ? `${l.aprovado_por} • ${l.aprovado_em ?? ""}` : "Pendente",
    ]),
    headStyles: { fillColor: FORTEM_GREEN, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  footer(doc);
  doc.save(`fechamento-ponto_${opts.mesReferencia}.pdf`);
}

export interface DivergenciaPdfRow {
  nome: string;
  data: string;
  status: StatusPonto;
  divergencia_total_dia?: number | null;
  minutos_descontaveis?: number | null;
  minutos_extras_validos?: number | null;
}

export function gerarRelatorioDivergencias(opts: {
  periodoInicio: string;
  periodoFim: string;
  linhas: DivergenciaPdfRow[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  header(
    doc,
    "Relatório de Divergências — Ponto",
    `${new Date(opts.periodoInicio).toLocaleDateString("pt-BR")} a ${new Date(opts.periodoFim).toLocaleDateString(
      "pt-BR",
    )}`,
  );

  autoTable(doc, {
    startY: 44,
    head: [["Profissional", "Data", "Status", "Δ Total", "Descontáveis", "Extras"]],
    body: opts.linhas.map((l) => [
      l.nome,
      new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR"),
      STATUS_PONTO_LABEL[l.status],
      `${l.divergencia_total_dia ?? 0}m`,
      `${l.minutos_descontaveis ?? 0}m`,
      `${l.minutos_extras_validos ?? 0}m`,
    ]),
    headStyles: { fillColor: FORTEM_GREEN, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  footer(doc);
  doc.save(`divergencias-ponto_${opts.periodoInicio}_a_${opts.periodoFim}.pdf`);
}
