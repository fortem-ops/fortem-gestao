import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";

export interface AnnexDetail {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string | null;
  data_nascimento?: string | null;
  signed_at: string;
  valid_until: string;
  medical_status: string;
  image_usage: boolean;
  signature_data?: string | null;
  ip_address?: string | null;
  attachment_url?: string | null;
  document_type: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

interface Props {
  annex: AnnexDetail | null;
  open: boolean;
  onClose: () => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isSafeHttpUrl = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

const AnnexDetailModal = ({ annex, open, onClose }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);
  if (!annex) return null;

  const isExperimental = annex.document_type === "experimental";
  const attachmentSafe = isSafeHttpUrl(annex.attachment_url);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const safeName = escapeHtml(annex.nome ?? "");
    const safeTitle = isExperimental ? "Declaração de Aptidão Física (Treino Experimental)" : "Declaração de Aptidão Física e Uso de Imagem";
    w.document.write(`<!DOCTYPE html><html><head><title>Documento - ${safeName}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1a1a2e}
      .header{text-align:center;margin-bottom:32px}.header h1{font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#555}
      .title{font-size:20px;font-weight:600;margin-bottom:24px;text-align:center}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}td{padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
      td:first-child{color:#888;width:40%}td:last-child{text-align:right;font-weight:500}
      img{max-width:300px;max-height:120px}.footer{margin-top:32px;text-align:center;font-size:11px;color:#aaa}
      @media print{body{margin:20px}}</style></head><body>
      <div class="header"><h1>FORTEM</h1></div>
      <div class="title">${safeTitle}</div>
      ${content.innerHTML}
      <div class="footer">Documento gerado automaticamente • Validade jurídica</div></body></html>`);
    w.document.close();
    w.print();
  };

  const signedDate = new Date(annex.signed_at);
  const validDate = new Date(annex.valid_until);
  const isExpired = validDate < new Date();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Documento</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-5">
          <table className="w-full">
            <tbody>
              <Row label="Tipo" value={isExperimental ? "Treino Experimental" : "Anexo Padrão (Aluno)"} />
              <Row label="Nome" value={annex.nome} />
              <Row label="CPF" value={annex.cpf} mono />
              <Row label="E-mail" value={annex.email} />
              {annex.telefone && <Row label="Telefone" value={annex.telefone} />}
              {annex.data_nascimento && <Row label="Data de nascimento" value={new Date(annex.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")} />}
              {annex.emergency_contact_name && <Row label="Contato de emergência" value={annex.emergency_contact_name} />}
              {annex.emergency_contact_phone && <Row label="Telefone emergência" value={annex.emergency_contact_phone} />}
              <Row label="Data de assinatura" value={`${signedDate.toLocaleDateString("pt-BR")} às ${signedDate.toLocaleTimeString("pt-BR")}`} />
              <Row label="Validade" value={validDate.toLocaleDateString("pt-BR")} />
              <Row label="Status" value={isExpired ? "Vencido" : "Regular"} valueClassName={isExpired ? "text-destructive" : "text-success"} />
              <Row label="Avaliação médica" value={annex.medical_status === "ok" ? "Sem restrições" : "Com restrições"} />
              {!isExperimental && <Row label="Uso de imagem" value={annex.image_usage ? "Autorizado" : "Não autorizado"} />}
              {annex.ip_address && <Row label="IP de assinatura" value={annex.ip_address} mono />}
            </tbody>
          </table>

          {annex.signature_data && (
            <div className="text-center space-y-2 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assinatura Digital</p>
              <img src={annex.signature_data} alt="Assinatura" className="mx-auto max-w-[280px] max-h-[100px] rounded-lg border border-border p-2 bg-secondary/30" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {attachmentSafe && (
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={annex.attachment_url!} target="_blank" rel="noopener noreferrer">
                <FileText className="w-4 h-4" /> Ver Atestado
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, mono, valueClassName }: { label: string; value: string; mono?: boolean; valueClassName?: string }) => (
  <tr className="border-b border-border/50 last:border-0">
    <td className="py-2.5 text-sm text-muted-foreground">{label}</td>
    <td className={cn("py-2.5 text-sm text-right font-medium text-foreground", mono && "font-mono", valueClassName)}>{value}</td>
  </tr>
);

export default AnnexDetailModal;
