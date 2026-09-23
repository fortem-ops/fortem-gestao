import { Download, Printer, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  gerarComprovanteEstornoPDF,
  linhasComprovante,
  type ComprovanteEstornoDados,
} from "@/lib/estornoPdf";

interface Props {
  dados: ComprovanteEstornoDados | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Comprovante de estorno — abre após o estorno e pode ser reaberto depois. */
export function ComprovanteEstornoDialog({ dados, open, onOpenChange }: Props) {
  if (!dados) return null;
  const linhas = linhasComprovante(dados);

  const imprimir = () => {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Comprovante de estorno — Fortem</title>
      <style>
        body{font-family:Helvetica,Arial,sans-serif;color:#0F1117;margin:32px}
        h1{font-size:20px;margin:0 0 4px}
        .sub{color:#666;margin:0 0 20px;font-size:13px}
        .bar{background:#22C55E;color:#fff;padding:10px 14px;font-weight:bold;margin:-32px -32px 24px}
        table{border-collapse:collapse;width:100%}
        td{border:1px solid #ddd;padding:8px 10px;font-size:13px;vertical-align:top}
        td:first-child{font-weight:bold;width:40%;background:#f7f7f7}
        .rodape{margin-top:24px;color:#888;font-size:11px}
      </style></head><body>
      <div class="bar">FORTEM — Gestão Técnica</div>
      <h1>Comprovante de estorno</h1>
      <p class="sub">${dados.integral ? "Estorno total" : "Estorno parcial"} da cobrança no cartão</p>
      <table>${linhas
        .map(([k, v]) => `<tr><td>${k}</td><td>${String(v).replace(/</g, "&lt;")}</td></tr>`)
        .join("")}</table>
      <p class="rodape">Documento gerado automaticamente pelo sistema Fortem. O prazo de devolução ao cartão depende da operadora e do banco emissor.</p>
      </body></html>`;
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Comprovante de estorno
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border divide-y text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-3 py-2">
              <span className="w-44 shrink-0 text-muted-foreground">{k}</span>
              <span className="font-medium break-words">{v}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={imprimir}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button onClick={() => gerarComprovanteEstornoPDF(dados)}>
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
