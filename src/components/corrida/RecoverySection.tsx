import recoveryImage from "@/assets/corrida/recovery.webp";
import { ScrollReveal } from "./ScrollReveal";

const RecoverySection = () => (
  <section className="py-24 md:py-32 bg-accent text-accent-foreground overflow-hidden">
    <div className="container mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        <ScrollReveal direction="left">
          <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Recovery Fortem</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Recupere melhor.<br /><span className="text-gradient">Treine melhor.</span>
          </h2>
          <p className="text-accent-foreground/70 text-lg mb-8">
            Os alunos da Assessoria Fortem possuem recovery gratuito com Bota de Compressão, ajudando na recuperação muscular e prevenção de lesões.
          </p>
          <div className="bg-accent-foreground/5 border border-accent-foreground/10 rounded-2xl p-6">
            <p className="font-display font-semibold mb-3 text-accent-foreground/90">Disponibilidade</p>
            <p className="text-sm text-accent-foreground/70 mb-1">Terças e Quintas</p>
            <div className="flex gap-3 flex-wrap">
              {["Manhã", "Tarde", "Noite"].map((t) => (
                <span key={t} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">{t}</span>
              ))}
            </div>
            <p className="text-xs text-accent-foreground/50 mt-3">Agendamento conforme disponibilidade.</p>
          </div>
        </ScrollReveal>
        <ScrollReveal direction="right">
          <div className="relative">
            <div className="rounded-2xl overflow-hidden">
              <img src={recoveryImage} alt="Recovery com bota de compressão" className="w-full h-[400px] object-cover" />
            </div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/20 rounded-full blur-3xl" />
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default RecoverySection;
