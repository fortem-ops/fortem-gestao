import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

interface Props {
  onCtaClick: () => void;
}

/** Topo da landing /planos: headline e CTA que rola até o funil. */
const HeroSection = ({ onCtaClick }: Props) => (
  <header className="relative py-20 sm:py-28 px-4 text-center border-b border-border">
    <p className="text-xs sm:text-sm tracking-[0.3em] text-primary font-semibold uppercase">
      Fortem Treinamento Físico
    </p>
    <h1 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
      Monte o teu plano de treinamento
    </h1>
    <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
      Escolhe a frequência semanal, compara os planos e finaliza a matrícula direto com a nossa equipe.
      Leva menos de um minuto.
    </p>
    <Button size="lg" className="mt-8" onClick={onCtaClick}>
      Montar meu plano
      <ArrowDown className="ml-2 h-4 w-4" />
    </Button>
  </header>
);

export default HeroSection;
