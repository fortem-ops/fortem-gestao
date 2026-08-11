import communityImage from "@/assets/corrida/community-race.jpg";
import runnersDuo from "@/assets/corrida/runners-duo.jpg";
import runnerWoman from "@/assets/corrida/runner-woman.jpg";
import runnersUrban from "@/assets/corrida/runners-urban.jpg";
import runnersPair from "@/assets/corrida/runners-pair.jpg";
import runnersGirls from "@/assets/corrida/runners-girls.jpg";
import runnersCouple from "@/assets/corrida/runners-couple.jpg";
import community1 from "@/assets/corrida/community-1.jpg";
import community2 from "@/assets/corrida/community-2.jpg";
import community3 from "@/assets/corrida/community-3.jpg";
import community4 from "@/assets/corrida/community-4.jpg";
import community5 from "@/assets/corrida/community-5.jpg";
import community6 from "@/assets/corrida/community-6.jpg";
import community7 from "@/assets/corrida/community-7.jpg";
import community8 from "@/assets/corrida/community-8.jpg";
import community9 from "@/assets/corrida/community-9.jpg";
import community10 from "@/assets/corrida/community-10.jpg";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";

const galleryImages = [
  { src: communityImage, alt: "Equipe Fortem correndo em grupo" },
  { src: runnersDuo, alt: "Dupla de corredores Fortem" },
  { src: runnerWoman, alt: "Corredora Fortem em prova" },
  { src: runnersUrban, alt: "Corredores Fortem em treino urbano" },
  { src: runnersPair, alt: "Dupla de corredores em treino" },
  { src: runnersGirls, alt: "Corredoras Fortem treinando juntas" },
  { src: runnersCouple, alt: "Casal de corredores Fortem" },
  { src: community1, alt: "Corredora Fortem na pista" },
  { src: community2, alt: "Corredora Fortem treino ao ar livre" },
  { src: community3, alt: "Dupla Fortem correndo juntos" },
  { src: community4, alt: "Dupla Fortem treino urbano" },
  { src: community5, alt: "Grupo Fortem correndo na avenida" },
  { src: community6, alt: "Trio de corredores Fortem" },
  { src: community7, alt: "Equipe Fortem em treino" },
  { src: community8, alt: "Corredora Fortem com boné" },
  { src: community9, alt: "Corredora Fortem com óculos de sol" },
  { src: community10, alt: "Dupla de corredoras Fortem" },
];

const CommunitySection = () => (
  <section className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="max-w-6xl mx-auto text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Comunidade</p>
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">Aqui você não corre sozinho.</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Treinar com a Fortem significa fazer parte de uma comunidade que compartilha evolução, provas, treinos e conquistas.
        </p>
      </ScrollReveal>

      <StaggerContainer staggerDelay={0.06} className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <StaggerItem className="col-span-2 row-span-2">
          <div className="rounded-2xl overflow-hidden h-full">
            <img src={galleryImages[0].src} alt={galleryImages[0].alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        </StaggerItem>
        {galleryImages.slice(1).map((img, i) => (
          <StaggerItem key={i}>
            <div className="rounded-2xl overflow-hidden aspect-[3/4]">
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  </section>
);

export default CommunitySection;
