import { MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onAceitar: () => void;
  onRecusar: () => void;
}

export function ConsentimentoGeoDialog({ open, onAceitar, onRecusar }: Props) {
  return (
    <Dialog open={open} onOpenChange={() => { /* só fecha via botões */ }}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Coleta de localização — Consentimento LGPD</DialogTitle>
          <DialogDescription className="sr-only">
            Solicitação de consentimento para coleta de geolocalização no ponto eletrônico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-foreground">
          <p>
            Para registrar seu ponto eletrônico, a Fortem coleta as coordenadas GPS do seu
            dispositivo no momento de cada batida. Esses dados são usados exclusivamente para
            verificar se o registro foi realizado em uma das unidades da Fortem e para fins de
            auditoria trabalhista, conforme exigido pela Portaria MTE 671/2021.
          </p>
          <p>
            Seus dados de localização são armazenados de forma segura e retidos por 5 anos,
            conforme obrigação legal trabalhista (Art. 11 da CLT). Você tem direito de acessar,
            corrigir e solicitar informações sobre seus dados a qualquer momento.
          </p>
          <Badge variant="outline" className="text-info border-info/30 bg-info/10 whitespace-normal text-left leading-snug py-1.5">
            Base legal: Legítimo interesse do empregador (Art. 7º, IX da LGPD) e obrigação legal (Art. 7º, II da LGPD)
          </Badge>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onRecusar}>
            Recusar
          </Button>
          <Button onClick={onAceitar}>Aceitar e continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
