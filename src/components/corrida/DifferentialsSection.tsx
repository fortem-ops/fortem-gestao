import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";

import diffPlanAsset from "@/assets/corrida/diff-plan.jpg.asset.json";
import diffPresencialAsset from "@/assets/corrida/diff-presencial.jpg.asset.json";
import diffAppAsset from "@/assets/corrida/diff-app.jpg.asset.json";
import diffRecoveryAsset from "@/assets/corrida/diff-recovery.jpg.asset.json";
import diffSedeAsset from "@/assets/corrida/diff-sede.jpg.asset.json";

const items = [
  { image: diffPlanAsset.url, title: "Planilha personalizada", description: "Treinamento adaptado ao seu objetivo." },
  { image: diffPresencialAsset.url, title: "Treinos presenciais", description: "Correção técnica e motivação em grupo." },
  { image: diffAppAsset.url, title: "Aplicativo exclusivo", description: "Planilha, agenda e acompanhamento." },
  { image: diffRecovery, title: "Recovery", description: "Bota de Compressão Gratuita" },
  { image: diffSedeAsset.url, title: "Sede", description: "Próxima à Redenção. Infra completa de vestiários." },
];

const DifferentialsSection = () => (
  <section className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Diferenciais</p>
        <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground">Por que a Fortem?</h2>
      </ScrollReveal>

      <StaggerContainer staggerDelay={0.1} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
        {items.map((item) => (
          <StaggerItem key={item.title}>
            <div className="text-center rounded-2xl bg-card shadow-card border border-border hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="aspect-square overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-4">
                <h3 className="font-display font-medium text-foreground mb-2 text-sm md:text-base">{item.title}</h3>
                <p className="text-muted-foreground text-xs md:text-sm">{item.description}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  </section>
);

export default DifferentialsSection;
