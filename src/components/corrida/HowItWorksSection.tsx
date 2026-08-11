import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";

import howStep1 from "@/assets/corrida/how-step1.jpg";
import howStep2 from "@/assets/corrida/how-step2.jpg";
import howStep3 from "@/assets/corrida/how-step3.jpg";
import howStep4 from "@/assets/corrida/how-step4.jpg";

const steps = [
  { image: howStep1, number: "01", title: "Faça um treino experimental", description: "Sem custo, sem compromisso, para entender mais a prática!" },
  { image: howStep2, number: "02", title: "Receba sua planilha personalizada", description: "Treinos adaptados ao seu nível e seus objetivos." },
  { image: howStep3, number: "03", title: "Treine com acompanhamento profissional", description: "Treinos presenciais com orientação técnica" },
  { image: howStep4, number: "04", title: "Acompanhe tudo pelo aplicativo", description: "Planilha, evolução e agendamentos" },
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Como funciona</p>
        <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground">Simples de começar</h2>
      </ScrollReveal>

      <StaggerContainer staggerDelay={0.15} className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {steps.map((step) => (
          <StaggerItem key={step.number}>
            <div className="relative group rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-500 border border-border overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={step.image} alt={step.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-6 relative">
                <span className="font-display text-5xl font-bold text-primary/10 absolute top-2 right-4">{step.number}</span>
                <h3 className="font-display text-lg font-medium text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  </section>
);

export default HowItWorksSection;
