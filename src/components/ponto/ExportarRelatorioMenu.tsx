import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileDown } from "lucide-react";

interface Props {
  onCSV: () => void;
  onXLSX: () => void;
  onPDF?: () => void;
  disabled?: boolean;
}

export function ExportarRelatorioMenu({ onCSV, onXLSX, onPDF, disabled }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCSV} className="gap-2">
          <FileText className="w-4 h-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onXLSX} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Excel (XLSX)
        </DropdownMenuItem>
        {onPDF && (
          <DropdownMenuItem onClick={onPDF} className="gap-2">
            <FileDown className="w-4 h-4" /> PDF (espelho)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
