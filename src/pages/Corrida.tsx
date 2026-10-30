import NbCortesiaBanner from "@/components/corrida/NbCortesiaBanner";
import CorridaConfigurator from "@/components/corrida/CorridaConfigurator";
import WhyFortemSection from "@/components/corrida/WhyFortemSection";
import TrainingLocationsSection from "@/components/corrida/TrainingLocationsSection";
import DifferentialsSection from "@/components/corrida/DifferentialsSection";
import MipoaSection from "@/components/corrida/MipoaSection";

import VideoTestimonialsSection from "@/components/corrida/VideoTestimonialsSection";

import CorridaFaqSection from "@/components/corrida/CorridaFaqSection";
import FinalCtaSection from "@/components/corrida/FinalCtaSection";
import { ComercioPublico } from "@/site/ComercioPublico";

const corridaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "Fortem — Grupo de Corrida",
  url: "https://www.soufortem.com.br/corrida",
  image: "https://www.soufortem.com.br/og-fortem.png",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Independência, 358",
    addressLocality: "Porto Alegre",
    addressRegion: "RS",
    addressCountry: "BR",
  },
  makesOffer: {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: "Assessoria de corrida em grupo",
      serviceType: "Treinamento de corrida",
      areaServed: "Porto Alegre, RS",
      provider: { "@type": "Organization", name: "Fortem Treinamento Físico" },
    },
  },
};

/**
 * Landing pública do Grupo de Corrida — rota /corrida.
 * Totalmente fora do shell autenticado (sem sidebar, sem RBAC).
 */
const Corrida = () => {
  const scrollToConfigurator = () =>
    document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <ComercioPublico
      titulo="Corrida FORTEM · Treino de corrida em Porto Alegre"
      descricao="Treine corrida em grupo com a FORTEM em Porto Alegre: assessoria técnica, treinos na orla e na pista, recovery e comunidade. Inscreva-se online."
      path="/corrida"
      origem="corrida"
      jsonLd={[corridaJsonLd]}
    >
      <div className="corrida-landing">
        <NbCortesiaBanner />
        <CorridaConfigurator />
        <WhyFortemSection />
        <TrainingLocationsSection />
        <DifferentialsSection />
        <MipoaSection />
        <VideoTestimonialsSection />
        <CorridaFaqSection />
        <FinalCtaSection onCtaClick={scrollToConfigurator} />
      </div>
    </ComercioPublico>
  );
};

export default Corrida;
