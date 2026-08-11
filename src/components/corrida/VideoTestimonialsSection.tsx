import { Star, Quote } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";

const testimonials = [
  {
    name: "Carolina Menezes",
    role: "Corredora há 2 anos",
    quote: "Comecei do zero e já completei minha primeira meia maratona. A planilha personalizada fez toda a diferença na minha evolução.",
    initials: "CM",
  },
  {
    name: "Rafael Drummond",
    role: "Aluno há 3 anos",
    quote: "O acompanhamento profissional nos treinos de pista corrigiu minha técnica e reduziu minhas lesões. Melhor investimento que fiz.",
    initials: "RD",
  },
  {
    name: "Juliana Bastos",
    role: "Corredora há 1 ano",
    quote: "A comunidade Fortem é incrível. Treinar em grupo me deu motivação para manter a consistência e bater todos os meus recordes.",
    initials: "JB",
  },
  {
    name: "Marcos Oliveira",
    role: "Aluno há 4 anos",
    quote: "O recovery com bota de compressão é um diferencial absurdo. Recupero muito mais rápido e consigo manter o volume de treino alto.",
    initials: "MO",
  },
];

const VideoTestimonialsSection = () => (
  <section className="py-24 md:py-32 bg-accent text-accent-foreground">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          Em ação
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold">
          Veja a Fortem <span className="text-gradient">em movimento.</span>
        </h2>
      </ScrollReveal>

      <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto items-start">
        {/* Video – vertical player */}
        <ScrollReveal delay={0.1}>
          <div className="rounded-2xl overflow-hidden shadow-card-hover mx-auto max-w-sm lg:max-w-none">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full aspect-[9/16] object-cover"
            >
              <source src="/__l5e/assets-v1/e6dc32c8-781e-446f-ba87-70a9e428cec2/fortem-highlight.mp4" type="video/mp4" />
              Seu navegador não suporta vídeo.
            </video>
          </div>
        </ScrollReveal>

        {/* Testimonials */}
        <StaggerContainer staggerDelay={0.12} className="grid gap-5">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="bg-card rounded-2xl p-6 shadow-card border border-border hover:shadow-card-hover transition-all duration-300 flex flex-col">
                <Quote className="w-6 h-6 text-primary/20 mb-3" />
                <p className="text-foreground/80 leading-relaxed mb-4 flex-1 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-xs">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                    <p className="text-muted-foreground text-xs">{t.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  </section>
);

export default VideoTestimonialsSection;
