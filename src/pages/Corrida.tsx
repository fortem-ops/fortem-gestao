import NbCortesiaBanner from "@/components/corrida/NbCortesiaBanner";
import CorridaConfigurator from "@/components/corrida/CorridaConfigurator";
import WhyFortemSection from "@/components/corrida/WhyFortemSection";
import TrainingLocationsSection from "@/components/corrida/TrainingLocationsSection";
import DifferentialsSection from "@/components/corrida/DifferentialsSection";
import MipoaSection from "@/components/corrida/MipoaSection";
import TestimonialsSection from "@/components/corrida/TestimonialsSection";
import VideoTestimonialsSection from "@/components/corrida/VideoTestimonialsSection";
import SocialProofSection from "@/components/corrida/SocialProofSection";
import CorridaFaqSection from "@/components/corrida/CorridaFaqSection";
import FinalCtaSection from "@/components/corrida/FinalCtaSection";
import WhatsAppButton from "@/components/corrida/WhatsAppButton";
import { Seo } from "@/components/Seo";

const corridaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "Fortem — Grupo de Corrida",
  url: "https://soufortem.com.br/corrida",
  image: "https://soufortem.com.br/icon-192.png",
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
    <div className="corrida-landing min-h-screen font-display">
      <Seo
        title="Grupo de Corrida — Fortem Porto Alegre"
        description="Treine corrida em grupo com a Fortem em Porto Alegre: assessoria técnica, treinos na orla e na pista, recovery e comunidade. Inscreva-se online."
        path="/corrida"
        jsonLd={corridaJsonLd}
      />
      <NbCortesiaBanner />
      <CorridaConfigurator />
      <WhyFortemSection />
      <TrainingLocationsSection />
      <DifferentialsSection />
      <MipoaSection />
      <TestimonialsSection />
      <VideoTestimonialsSection />
      <SocialProofSection />
      <CorridaFaqSection />
      <FinalCtaSection onCtaClick={scrollToConfigurator} />

      <WhatsAppButton />
    </div>
  );
};

export default Corrida;
