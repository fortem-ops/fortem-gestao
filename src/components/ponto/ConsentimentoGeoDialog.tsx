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
import { PoliticaRetencaoCard } from "@/components/ponto/PoliticaRetencaoCard";

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
            A FORTEM utiliza sistema eletrônico de registro de ponto por navegador, com coleta de
            geolocalização <strong>exclusivamente no momento da marcação</strong> de entrada, saída e
            intervalos, com a finalidade de comprovar o local do registro de jornada.{" "}
            <strong>Não há rastreamento contínuo do colaborador.</strong>
          </p>
          <p>
            Quando você não desejar utilizar dispositivo próprio, a Fortem disponibilizará
            equipamento no local de trabalho para realização da marcação — nesse caso, clique em{" "}
            <strong>Recusar</strong> abaixo.
          </p>
          <p className="text-muted-foreground">
            Os dados de localização são armazenados de forma segura e retidos por 5 anos, conforme
            obrigação legal trabalhista (Art. 11 da CLT). Você tem direito de acessar, corrigir e
            solicitar informações sobre seus dados a qualquer momento.
          </p>
          <Badge
            variant="outline"
            className="text-info border-info/30 bg-info/10 whitespace-normal text-left leading-snug py-1.5"
          >
            Base legal: Legítimo interesse do empregador (Art. 7º, IX da LGPD) e obrigação legal
            (Art. 7º, II da LGPD)
          </Badge>
          <PoliticaRetencaoCard defaultExpanded />
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
