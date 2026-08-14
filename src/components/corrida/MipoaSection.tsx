import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";

import m1 from "@/assets/corrida/mipoa/mipoa-1.jpg.asset.json";
import m2 from "@/assets/corrida/mipoa/mipoa-2.jpg.asset.json";
import m3 from "@/assets/corrida/mipoa/mipoa-3.jpg.asset.json";
import m4 from "@/assets/corrida/mipoa/mipoa-4.jpg.asset.json";
import m5 from "@/assets/corrida/mipoa/mipoa-5.jpg.asset.json";
import m6 from "@/assets/corrida/mipoa/mipoa-6.jpg.asset.json";
import m7 from "@/assets/corrida/mipoa/mipoa-7.jpg.asset.json";
import m8 from "@/assets/corrida/mipoa/mipoa-8.jpg.asset.json";
import m9 from "@/assets/corrida/mipoa/mipoa-9.jpg.asset.json";
import m10 from "@/assets/corrida/mipoa/mipoa-10.jpg.asset.json";

const fotos = [
  { src: m1.url, alt: "Equipe Fortem reunida na tenda da Maratona Internacional de Porto Alegre 2026", wide: true },
  { src: m2.url, alt: "Corredora Fortem com medalha da MIPOA 2026" },
  { src: m3.url, alt: "Corredor Fortem exibindo a medalha da MIPOA 2026" },
  { src: m4.url, alt: "Aluna Fortem com medalha ao lado da bandeira da Fortem" },
  { src: m5.url, alt: "Corredor Fortem com medalha após a prova" },
  { src: m6.url, alt: "Atleta Fortem com medalha da Maratona de Porto Alegre" },
  { src: m7.url, alt: "Corredor Fortem comemorando a conquista na MIPOA" },
  { src: m8.url, alt: "Aluna Fortem com medalha dos 5km da MIPOA 2026" },
  { src: m9.url, alt: "Aluna Fortem com medalha dos 10km da MIPOA 2026" },
  { src: m10.url, alt: "Aluna Fortem mordendo a medalha da MIPOA 2026" },
];

const MipoaSection = () => (
  <section className="py-24 md:py-32 bg-accent text-accent-foreground overflow-hidden">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-14">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          Fortem na prova
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold">
          Fortem na <span className="text-gradient">MIPOA 2026</span>
        </h2>
        <p className="mt-5 text-accent-foreground/70 text-lg max-w-2xl mx-auto font-light">
          Nossa equipe na Maratona Internacional de Porto Alegre: estrutura, apoio e muita medalha no peito.
        </p>
      </ScrollReveal>

      <StaggerContainer staggerDelay={0.08} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-6xl mx-auto">
        {fotos.map((foto) => (
          <StaggerItem key={foto.src} className={foto.wide ? "col-span-2 row-span-2" : ""}>
            <div className={`overflow-hidden rounded-2xl h-full ${foto.wide ? "aspect-square md:aspect-auto md:h-full" : "aspect-[3/4]"}`}>
              <img
                src={foto.src}
                alt={foto.alt}
                loading="lazy"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  </section>
);

export default MipoaSection;
