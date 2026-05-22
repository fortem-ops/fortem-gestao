import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  filename: string;
  rows: Record<string, any>[];
  columns?: { key: string; label: string }[];
}

function toCSV(rows: Record<string, any>[], columns?: { key: string; label: string }[]) {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const head = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c.key];
          if (v == null) return "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportMenu({ filename, rows, columns }: Props) {
  const handle = (fmt: "csv" | "xlsx") => {
    if (!rows.length) {
      toast.error("Nada para exportar");
      return;
    }
    const csv = toCSV(rows, columns);
    if (fmt === "csv") {
      download(`${filename}.csv`, csv, "text/csv;charset=utf-8");
    } else {
      // XLSX: usamos CSV com BOM para abrir bem no Excel
      download(`${filename}.xls`, "\uFEFF" + csv, "application/vnd.ms-excel");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handle("csv")} className="gap-2">
          <FileText className="h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("xlsx")} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
