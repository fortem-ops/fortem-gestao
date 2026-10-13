/**
 * Exportação de despesas em XLSX e PDF.
 * XLSX segue o padrão de relatorioPontoExport.ts; PDF segue o padrão de pontoPdf.ts
 * (jsPDF + jspdf-autotable, cores em RGB).
 */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DespesaExportRow {
  vencimento: string;
  pagamento: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  tipo: string;
  status: string;
  forma: string;
  conta: string;
  parcela: string;
  valor: number;
  valorPago: number | null;
  conciliado: string;
}

export interface DespesasExportMeta {
  periodo: string;
  base: string;
  filtros: string[];
  apenasSelecionadas: boolean;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const FORTEM_GREEN: [number, number, number] = [34, 197, 94];
const FORTEM_DARK: [number, number, number] = [15, 17, 23];

function nomeArquivo(meta: DespesasExportMeta, ext: string) {
  const slug = meta.periodo.replaceAll("/", "-").replaceAll(" ", "");
  return `despesas-${slug}.${ext}`;
}

export function exportarDespesasXLSX(linhas: DespesaExportRow[], meta: DespesasExportMeta) {
  const wb = XLSX.utils.book_new();

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalPago = linhas.reduce((s, l) => s + (l.valorPago ?? 0), 0);
  const resumo = [
    { Campo: "Período", Valor: meta.periodo },
    { Campo: "Base da data", Valor: meta.base },
    { Campo: "Filtros", Valor: meta.filtros.length ? meta.filtros.join(" · ") : "Nenhum" },
    { Campo: "Escopo", Valor: meta.apenasSelecionadas ? "Somente selecionadas" : "Todas as filtradas" },
    { Campo: "Total de lançamentos", Valor: linhas.length },
    { Campo: "Soma dos valores", Valor: brl(totalValor) },
    { Campo: "Soma dos valores pagos", Valor: brl(totalPago) },
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      linhas.map((l) => ({
        Vencimento: l.vencimento,
        Pagamento: l.pagamento,
        Descrição: l.descricao,
        Fornecedor: l.fornecedor,
        Categoria: l.categoria,
        Tipo: l.tipo,
        Status: l.status,
        "Forma de pagamento": l.forma,
        Conta: l.conta,
        Parcela: l.parcela,
        Valor: brl(l.valor),
        "Valor pago": l.valorPago != null ? brl(l.valorPago) : "",
        Conciliado: l.conciliado,
      })),
    ),
    "Despesas",
  );

  XLSX.writeFile(wb, nomeArquivo(meta, "xlsx"));
}

function header(doc: jsPDF, subtitulo: string) {
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
  doc.text("Despesas", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(subtitulo, 14, 37, { maxWidth: doc.internal.pageSize.getWidth() - 28 });
  doc.setTextColor(...FORTEM_DARK);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("FORTEM — Relatório de despesas", 14, h - 8);
    doc.text(`${i}/${pages}`, w - 14, h - 8, { align: "right" });
  }
}

export function exportarDespesasPDF(linhas: DespesaExportRow[], meta: DespesasExportMeta) {
  const doc = new jsPDF({ orientation: "landscape" });
  const filtros = meta.filtros.length ? ` · Filtros: ${meta.filtros.join(" · ")}` : "";
  const escopo = meta.apenasSelecionadas ? " · Somente selecionadas" : "";
  header(doc, `Período: ${meta.periodo} · Base: ${meta.base}${filtros}${escopo}`);

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalPago = linhas.reduce((s, l) => s + (l.valorPago ?? 0), 0);

  autoTable(doc, {
    startY: 44,
    head: [[
      "Vencimento", "Pagamento", "Descrição", "Fornecedor", "Categoria", "Tipo",
      "Status", "Forma", "Conta", "Parcela", "Valor", "Valor pago", "Conciliado",
    ]],
    body: linhas.map((l) => [
      l.vencimento, l.pagamento, l.descricao, l.fornecedor, l.categoria, l.tipo,
      l.status, l.forma, l.conta, l.parcela, brl(l.valor),
      l.valorPago != null ? brl(l.valorPago) : "—", l.conciliado,
    ]),
    foot: [[
      "", "", `Total (${linhas.length} lançamentos)`, "", "", "", "", "", "", "",
      brl(totalValor), brl(totalPago), "",
    ]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: FORTEM_GREEN, textColor: [255, 255, 255], fontSize: 7 },
    footStyles: { fillColor: [240, 240, 240], textColor: FORTEM_DARK, fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      10: { halign: "right" },
      11: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  footer(doc);
  doc.save(nomeArquivo(meta, "pdf"));
}
