import { useState } from "react";
import NbCortesiaBanner from "@/components/corrida/NbCortesiaBanner";
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

type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
type Tier = "start" | "start_plus" | "power" | "pro" | "max";

/**
 * Landing pública do Grupo de Corrida — rota /corrida.
 * Totalmente fora do shell autenticado (sem sidebar, sem RBAC).
 */
const Corrida = () => {
  const [selecao, setSelecao] = useState<{ rota: Rota; tier: Tier | null; nome: string | null } | null>(null);

  const scrollToConfigurator = () =>
    document.getElementById("configurador")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSelect = (rota: Rota, tier: Tier | null = null, nome: string | null = null) => {
    setSelecao({ rota, tier, nome });
    setTimeout(scrollToConfigurator, 60);
  };

  return (
    <div className="corrida-landing min-h-screen font-display">
      <NbCortesiaBanner onSelect={handleSelect} />
      <CorridaConfigurator
        rota={selecao?.rota ?? null}
        tier={selecao?.tier ?? null}
        nome={selecao?.nome ?? null}
        onTrocarRota={handleSelect}
      />
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
