/**
 * Comprovante de estorno em PDF — identidade visual Fortem
 * (mesmo cabeçalho verde/escuro usado nos demais relatórios do sistema).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FORTEM_GREEN: [number, number, number] = [34, 197, 94];
const FORTEM_DARK: [number, number, number] = [15, 17, 23];

export interface ComprovanteEstornoDados {
  aluno_nome: string;
  numero_ciclo?: number | null;
  valor_estornado: number;
  valor_original: number;
  total_estornado?: number;
  integral: boolean;
  tid: string | null;
  nsu: string | null;
  authorization_code?: string | null;
  return_code: string | null;
  return_message: string | null;
  motivo: string;
  executado_em: string;
  executado_por_nome: string;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Data e hora sempre no fuso de Brasília. */
export function dataHoraBrasilia(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function linhasComprovante(d: ComprovanteEstornoDados): [string, string][] {
  return [
    ["Aluno", d.aluno_nome],
    ["Ciclo", d.numero_ciclo ? String(d.numero_ciclo) : "—"],
    ["Valor original da cobrança", brl(d.valor_original)],
    ["Valor estornado", brl(d.valor_estornado)],
    ["Tipo de estorno", d.integral ? "Total" : "Parcial"],
    ...(d.total_estornado != null && !d.integral
      ? ([["Total já estornado", brl(d.total_estornado)]] as [string, string][])
      : []),
    ["TID", d.tid ?? "—"],
    ["NSU", d.nsu ?? "—"],
    ["Código de autorização", d.authorization_code ?? "—"],
    ["Retorno da operadora", `${d.return_code ?? "—"} — ${d.return_message ?? "—"}`],
    ["Data e hora (Brasília)", dataHoraBrasilia(d.executado_em)],
    ["Executado por", d.executado_por_nome],
    ["Motivo", d.motivo],
  ];
}

export function gerarComprovanteEstornoPDF(d: ComprovanteEstornoDados) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...FORTEM_GREEN);
  doc.rect(0, 0, w, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FORTEM — Gestão Técnica", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dataHoraBrasilia(new Date().toISOString()), w - 14, 12, { align: "right" });

  doc.setTextColor(...FORTEM_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Comprovante de estorno", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(
    d.integral ? "Estorno total da cobrança no cartão" : "Estorno parcial da cobrança no cartão",
    14,
    37,
  );

  autoTable(doc, {
    startY: 44,
    theme: "grid",
    head: [["Informação", "Detalhe"]],
    body: linhasComprovante(d),
    headStyles: { fillColor: FORTEM_DARK, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Documento gerado automaticamente pelo sistema Fortem. O prazo de devolução ao cartão depende da operadora e do banco emissor.",
    14,
    h - 10,
    { maxWidth: w - 28 },
  );

  const nome = `comprovante-estorno-${(d.tid ?? "sem-tid")}-${d.executado_em.slice(0, 10)}.pdf`;
  doc.save(nome);
}
