import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Seo } from "@/components/Seo";
import HeroSection from "@/components/planos/HeroSection";
import ProgressBar from "@/components/planos/ProgressBar";
import SocialProof from "@/components/planos/SocialProof";
import StepFrequency from "@/components/planos/StepFrequency";
import StepPlans from "@/components/planos/StepPlans";
import StepSummary from "@/components/planos/StepSummary";
import {
  FREQUENCIAS,
  PLANOS,
  nomePlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

const planosJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Planos de treinamento Fortem",
  serviceType: "Treinamento físico personalizado",
  areaServed: "Porto Alegre, RS",
  url: "https://soufortem.com.br/planos",
  provider: { "@type": "Organization", name: "Fortem Treinamento Físico" },
  offers: FREQUENCIAS.flatMap((f) =>
    PLANOS.map((p) => ({
      "@type": "Offer",
      name: `${nomePlano(f.id, p.id)} — ${f.label}`,
      price: precoDe(f.id, p.id).toFixed(2),
      priceCurrency: "BRL",
      category: "Mensalidade",
    })),
  ),
};

/**
 * Landing pública dos planos — rota /planos.
 * Funil de 3 etapas (Frequência → Plano → Resumo), fora do shell autenticado.
 */
const Planos = () => {
  const [step, setStep] = useState(0);
  const [frequencia, setFrequencia] = useState<FrequenciaPlano | null>(null);
  const [plano, setPlano] = useState<PlanoId | null>(null);

  const scrollToFunil = () =>
    document.getElementById("funil")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const selecionarFrequencia = (f: FrequenciaPlano) => {
    setFrequencia(f);
    setStep(1);
    scrollToFunil();
  };

  const selecionarPlano = (p: PlanoId) => {
    setPlano(p);
    setStep(2);
    scrollToFunil();
  };

  return (
    <div className="planos-landing min-h-screen font-display">
      <Seo
        title="Planos de Treinamento — Fortem"
        description="Monte seu plano de treinamento na Fortem em Porto Alegre: escolha a frequência semanal (2x ou 3x), compare horário livre e horário ocioso e fale com a equipe."
        path="/planos"
        jsonLd={planosJsonLd}
      />

      <HeroSection onCtaClick={scrollToFunil} />

      <main id="funil" className="max-w-5xl mx-auto px-4 py-12 space-y-8 scroll-mt-4">
        <ProgressBar current={step} onStepClick={setStep} />

        {step > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        )}

        {step === 0 && <StepFrequency value={frequencia} onSelect={selecionarFrequencia} />}

        {step === 1 && frequencia && (
          <StepPlans frequencia={frequencia} value={plano} onSelect={selecionarPlano} />
        )}

        {step === 2 && frequencia && plano && (
          <StepSummary frequencia={frequencia} plano={plano} />
        )}
      </main>


      <SocialProof />

      <footer className="py-8 flex flex-col items-center gap-3 border-t border-border bg-background">
        <img src="/fortem-logo.png" alt="Fortem" className="h-6" />
      </footer>
    </div>
  );
};

export default Planos;
