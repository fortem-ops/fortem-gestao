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

const TestimonialsSection = () => (
  <section className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          Depoimentos
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">
          O que nossos alunos dizem
        </h2>
      </ScrollReveal>

      <StaggerContainer staggerDelay={0.12} className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {testimonials.map((t) => (
          <StaggerItem key={t.name}>
            <div className="bg-card rounded-2xl p-8 shadow-card border border-border hover:shadow-card-hover transition-all duration-300 h-full flex flex-col">
              <Quote className="w-8 h-8 text-primary/20 mb-4" />
              <p className="text-foreground/80 text-lg leading-relaxed mb-6 flex-1 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-sm">
                  {t.initials}
                </div>
                <div>
                  <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  </section>
);

export default TestimonialsSection;
