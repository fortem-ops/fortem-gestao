import HeroSection from "@/components/corrida/HeroSection";
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
  // Placeholder: por enquanto o CTA apenas rola a página para o topo.
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="corrida-landing min-h-screen font-display">
      <HeroSection onCtaClick={scrollToTop} />
      <HowItWorksSection />
      <TrainingLocationsSection />
      <DifferentialsSection />
      <RecoverySection />
      <CommunitySection />
      <TestimonialsSection />
      <VideoTestimonialsSection />
      <SocialProofSection />
      <FinalCtaSection onCtaClick={scrollToTop} />
      <WhatsAppButton />
    </div>
  );
};

export default Corrida;
