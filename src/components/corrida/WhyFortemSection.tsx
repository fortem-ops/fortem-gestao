import Autoplay from "embla-carousel-autoplay";
import { ScrollReveal } from "./ScrollReveal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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

const stats = [
  { value: "10", suffix: " anos", label: "de história da Fortem" },
  { value: "+2.000", suffix: "", label: "atendidos ao longo desses 10 anos" },
  { value: "+180", suffix: "", label: "sendo acompanhados atualmente" },
];

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

const WhyFortemSection = () => (
  <section className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-14">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          A FORTEM
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground">
          Assessoria nova.<br />Estrutura madura.
        </h2>
      </ScrollReveal>

      <ScrollReveal className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-card border border-border shadow-card p-8 text-center"
            >
              <div className="font-display text-5xl md:text-6xl font-bold text-foreground">
                {s.value}
                <span className="text-primary">{s.suffix}</span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-8 text-center">
          <p className="text-muted-foreground text-base md:text-lg">
            A Assessoria de Corrida está no seu primeiro ano — mas ela nasce dentro de uma
            estrutura já madura. A Fortem já oferece Treinamento (Academia e Corrida),
            Nutrição e Reabilitação sob o mesmo teto, com a mesma equipe cuidando de você
            de ponta a ponta.
          </p>
          <p className="mt-6 inline-block text-xs md:text-sm uppercase tracking-[0.25em] text-primary font-display font-semibold border border-primary/30 rounded-full px-5 py-2">
            Inteligência em Saúde Integrada
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal className="max-w-5xl mx-auto mt-12">
        <Carousel
          opts={{ loop: true, align: "start" }}
          plugins={[Autoplay({ delay: 3000, stopOnInteraction: false })]}
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {galleryImages.map((img) => (
              <CarouselItem key={img.alt} className="pl-3 md:pl-4 basis-2/3 sm:basis-1/2 md:basis-1/3">
                <div className="rounded-2xl overflow-hidden aspect-[3/4]">
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
      </ScrollReveal>
    </div>
  </section>
);

export default WhyFortemSection;
