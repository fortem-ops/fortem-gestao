import NbCortesiaBanner from "@/components/corrida/NbCortesiaBanner";
import CorridaConfigurator from "@/components/corrida/CorridaConfigurator";
import WhyFortemSection from "@/components/corrida/WhyFortemSection";
import TrainingLocationsSection from "@/components/corrida/TrainingLocationsSection";
import DifferentialsSection from "@/components/corrida/DifferentialsSection";
import RecoverySection from "@/components/corrida/RecoverySection";
import CommunitySection from "@/components/corrida/CommunitySection";
import TestimonialsSection from "@/components/corrida/TestimonialsSection";
import VideoTestimonialsSection from "@/components/corrida/VideoTestimonialsSection";
import SocialProofSection from "@/components/corrida/SocialProofSection";
import CorridaFaqSection from "@/components/corrida/CorridaFaqSection";
import FinalCtaSection from "@/components/corrida/FinalCtaSection";
import WhatsAppButton from "@/components/corrida/WhatsAppButton";


/**
 * Landing pública do Grupo de Corrida — rota /corrida.
 * Totalmente fora do shell autenticado (sem sidebar, sem RBAC).
 */
const Corrida = () => {
  const scrollToConfigurator = () =>
    document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="corrida-landing min-h-screen font-display">
      <NbCortesiaBanner />
      <CorridaConfigurator />
      <WhyFortemSection />
      <TrainingLocationsSection />
      <DifferentialsSection />
      <RecoverySection />
      <CommunitySection />
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
