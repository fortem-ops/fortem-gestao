import { useState } from "react";
import { Seo } from "@/components/Seo";
import HeroSection from "@/components/planos/HeroSection";
import SocialProof from "@/components/planos/SocialProof";
import PlanosGrid, { type SelecaoPlano } from "@/components/planos/PlanosGrid";
import StepSummary from "@/components/planos/StepSummary";
import { FREQUENCIAS, PLANOS, nomePlano, precoDe } from "@/data/planosPricing";

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
 * Todos os planos e valores em uma grade única, com resumo abaixo.
 */
const Planos = () => {
  const [selecao, setSelecao] = useState<SelecaoPlano | null>(null);

  const scrollToFunil = () =>
    document.getElementById("funil")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const selecionar = (s: SelecaoPlano) => {
    setSelecao(s);
    requestAnimationFrame(() =>
      document.getElementById("resumo")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="planos-landing min-h-screen font-display">
      <Seo
        title="Planos de Treinamento — Fortem"
        description="Planos de treinamento da Fortem em Porto Alegre: 2x ou 3x por semana, horário livre ou horário ocioso (9h às 16h). Compare valores e fale com a equipe."
        path="/planos"
        jsonLd={planosJsonLd}
      />

      <HeroSection onCtaClick={scrollToFunil} />

      <main id="funil" className="max-w-6xl mx-auto px-4 py-12 space-y-12 scroll-mt-4">
        <PlanosGrid value={selecao} onSelect={selecionar} />

        {selecao && (
          <div id="resumo" className="scroll-mt-4">
            <StepSummary frequencia={selecao.frequencia} plano={selecao.plano} />
          </div>
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
