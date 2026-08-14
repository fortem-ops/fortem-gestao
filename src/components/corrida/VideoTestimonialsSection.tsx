import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";
import posterAsset from "@/assets/corrida/fortem-highlight-poster.webp.asset.json";

const VIDEO_SRC = "/__l5e/assets-v1/e6dc32c8-781e-446f-ba87-70a9e428cec2/fortem-highlight.mp4";

/** Só baixa e inicia o vídeo quando ele realmente entra no viewport (200px de margem). */
const LazyTestimonialVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    const el = videoRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => undefined);
  }, [inView]);

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      poster={posterAsset.url}
      className="w-full aspect-[9/16] object-cover"
    >
      {inView && <source src={VIDEO_SRC} type="video/mp4" />}
      Seu navegador não suporta vídeo.
    </video>
  );
};

const testimonials = [
  {
    name: "M. J.",
    role: "Corredora há 9 meses",
    quote: "Nunca havia corrido e tinha medo de me machucar. A equipe da Fortem me auxiliou a atingir o meu objetivo: correr 5km sem caminhar. Já fiz 4 provas e agora quero os 10km!",
    initials: "MJ",
  },
  {
    name: "B.M.",
    role: "Aluna há 1 ano",
    quote: "A equipe multidisciplinar da Fortem me ajuda a ter uma prática saudável na corrida",
    initials: "BM",
  },
  {
    name: "M.P.",
    role: "Aluna há 2 anos",
    quote: "Amo a comunidade da Fortem! Pessoas que me motivam a ter mais saúde.",
    initials: "MP",
  },
  {
    name: "J.N.",
    role: "Aluno há 5 anos",
    quote: "Aqui tenho tudo que preciso para os meus treinos e objetivos. Do profissionalismo à estrutura.",
    initials: "JN",
  },
];

const VideoTestimonialsSection = () => (
  <section className="py-24 md:py-32 bg-accent text-accent-foreground">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          Depoimentos
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold">
          o que os nossos alunos dizem
        </h2>
      </ScrollReveal>

      <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto items-start">
        {/* Video – vertical player */}
        <ScrollReveal delay={0.1}>
          <div className="rounded-2xl overflow-hidden shadow-card-hover mx-auto max-w-sm lg:max-w-none">
            <LazyTestimonialVideo />
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
