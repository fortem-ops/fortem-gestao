import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface Row {
  label: string;
  left: string | number;
  leftClass: string;
  right: string | number;
  rightClass: string;
}

interface ExportArgs {
  student: Tables<"alunos">;
  tipo: string;
  rows: Row[];
  notes?: string;
}

export function exportAssessmentPDF({ student, tipo, rows, notes }: ExportArgs) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(220, 38, 38); // red brand
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FORTEM — Gestão Técnica", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(tipo, pageWidth - 14, 12, { align: "right" });

  // Student info
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Aluno: ${student.nome}`, 14, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Data da avaliação: ${today}`, 14, 38);
  if (student.email) doc.text(`E-mail: ${student.email}`, 14, 43);
  if (student.telefone) doc.text(`Telefone: ${student.telefone}`, 14, 48);

  // Table
  const hasSides = rows.some(r => r.right !== "" && r.right !== null && r.right !== undefined);
  const head = hasSides
    ? [["Métrica", "Esquerdo", "Class. E", "Direito", "Class. D"]]
    : [["Item", "Valor", "Classificação"]];
  const body = rows.map(r => hasSides
    ? [r.label, String(r.left ?? "—"), r.leftClass || "—", String(r.right ?? "—"), r.rightClass || "—"]
    : [r.label, String(r.left ?? "—"), r.leftClass || "—"]);

  autoTable(doc, {
    head,
    body,
    startY: 55,
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
  });

  // Notes
  if (notes && notes.trim()) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações do Avaliador", 14, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(notes, pageWidth - 28);
    doc.text(lines, 14, finalY + 16);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Documento gerado automaticamente — Fortem Gestão Técnica", pageWidth / 2, pageHeight - 8, { align: "center" });

  const safeName = student.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `avaliacao-${safeName}-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(filename);
}
