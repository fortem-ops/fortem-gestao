import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ContratoDetail {
  id: string;
  conteudo_gerado: string;
  aceite: boolean;
  data_aceite: string | null;
  formato_aceite: string | null;
  ip_aceite: string | null;
  created_at: string;
}

interface Props {
  contrato: ContratoDetail | null;
  open: boolean;
  onClose: () => void;
}

function preencherMergeFields(
  html: string,
  values: { assinatura?: string; aceite?: string; data_aceite?: string; formato_aceite?: string; ip_aceite?: string },
) {
  return html
    .replace(/%ASSINATURA%/g, values.assinatura ?? "")
    .replace(/%ACEITE%/g, values.aceite ?? "")
    .replace(/%DATA_ACEITE%/g, values.data_aceite ?? "")
    .replace(/%FORMATO_ACEITE%/g, values.formato_aceite ?? "")
    .replace(/%IP_ACEITE%/g, values.ip_aceite ?? "");
}

const ContratoDetailModal = ({ contrato, open, onClose }: Props) => {
  if (!contrato) return null;

  const conteudo = contrato.aceite
    ? preencherMergeFields(contrato.conteudo_gerado, {
        assinatura: "Assinatura eletrônica confirmada",
        aceite: "Aceito",
        data_aceite: contrato.data_aceite
          ? format(new Date(contrato.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "",
        formato_aceite: "Aceite digital via Portal do Aluno",
        ip_aceite: contrato.ip_aceite ?? "",
      })
    : preencherMergeFields(contrato.conteudo_gerado, {});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Contrato de Prestação de Serviços</DialogTitle>
        </DialogHeader>
        <div
          className="flex-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-4 prose prose-sm prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: conteudo }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ContratoDetailModal;
