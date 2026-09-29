import * as XLSX from "xlsx";
import { formatBRL } from "@/lib/vendas";

export interface EncomendaExport {
  cliente: string;
  produto: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  valorItens: number;
  valorRecebido: number;
  cupom: string | null;
  brinde: string | null;
  data: string;
  status: string;
  resumoPedido: string;
}

const STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  aguardando_pagamento: "Aguardando pagamento",
  estornado: "Estornado",
};

export function exportarEncomendasXLSX(linhas: EncomendaExport[], periodo: { de?: string; ate?: string }) {
  const wb = XLSX.utils.book_new();

  const totalQtd = linhas.reduce((s, l) => s + l.quantidade, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.valorRecebido, 0);
  const periodoTxt = periodo.de || periodo.ate ? `${periodo.de || "início"} até ${periodo.ate || "hoje"}` : "Tudo";

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Campo: "Período", Valor: periodoTxt },
      { Campo: "Total de itens", Valor: linhas.length },
      { Campo: "Total de peças", Valor: totalQtd },
      { Campo: "Total recebido", Valor: formatBRL(totalRecebido) },
      { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
    ]),
    "Resumo",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      linhas.map((l) => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Cliente: l.cliente,
        Modelo: l.produto,
        Cor: l.cor,
        Tamanho: l.tamanho,
        "Qtd.": l.quantidade,
        "Valor dos itens": formatBRL(l.valorItens),
        "Valor recebido": formatBRL(l.valorRecebido),
        Cupom: l.cupom ?? "",
        Brinde: l.brinde ?? "",
        Status: STATUS_LABEL[l.status] ?? l.status,
        "Resumo do pedido": l.resumoPedido,
      })),
    ),
    "Encomendas",
  );

  const nome = periodo.de || periodo.ate ? `encomendas-${periodo.de || "inicio"}_${periodo.ate || "hoje"}.xlsx` : "encomendas-completo.xlsx";
  XLSX.writeFile(wb, nome);
}
