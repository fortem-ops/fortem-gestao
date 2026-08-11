import HeroSection from "@/components/corrida/HeroSection";
import CorridaConfigurator from "@/components/corrida/CorridaConfigurator";
import HowItWorksSection from "@/components/corrida/HowItWorksSection";
import TrainingLocationsSection from "@/components/corrida/TrainingLocationsSection";
import DifferentialsSection from "@/components/corrida/DifferentialsSection";
import RecoverySection from "@/components/corrida/RecoverySection";
import CommunitySection from "@/components/corrida/CommunitySection";
import TestimonialsSection from "@/components/corrida/TestimonialsSection";
import VideoTestimonialsSection from "@/components/corrida/VideoTestimonialsSection";
import SocialProofSection from "@/components/corrida/SocialProofSection";
import FinalCtaSection from "@/components/corrida/FinalCtaSection";
import WhatsAppButton from "@/components/corrida/WhatsAppButton";

/**
 * Landing pública do Grupo de Corrida — rota /corrida.
 * Totalmente fora do shell autenticado (sem sidebar, sem RBAC).
 * Etapa atual: apenas visual. O configurador de plano será conectado depois.
 */
const Corrida = () => {
  const scrollToConfigurator = () =>
    document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="corrida-landing min-h-screen font-display">
      <HeroSection onCtaClick={scrollToConfigurator} />
      <CorridaConfigurator />
      <HowItWorksSection />
      <TrainingLocationsSection />
      <DifferentialsSection />
      <RecoverySection />
      <CommunitySection />
      <TestimonialsSection />
      <VideoTestimonialsSection />
      <SocialProofSection />
      <FinalCtaSection onCtaClick={scrollToConfigurator} />
      <WhatsAppButton />
    </div>
  );
};

export default Corrida;
