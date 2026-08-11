import heroImage from "@/assets/corrida/hero-runners.jpg";
import { motion } from "framer-motion";

const HeroSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImage} alt="Corredores treinando em grupo" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent/80 via-accent/70 to-accent/95" />
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-primary font-display font-semibold tracking-[0.3em] uppercase text-sm mb-6"
          >
            Assessoria de Corrida
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-accent-foreground leading-[0.95] mb-6"
          >
            <span className="text-gradient">Corra com a Fortem.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg md:text-xl text-accent-foreground/70 max-w-2xl mx-auto mb-10 font-light"
          >
            Assessoria de Corrida — treinos técnicos, pacers e uma comunidade que te leva mais longe.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={onCtaClick}
              className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-display font-semibold text-lg hover:scale-105 transition-all duration-300 glow-red"
            >
              Montar meu plano de corrida
            </button>
            <a
              href="#como-funciona"
              className="border border-accent-foreground/20 text-accent-foreground px-8 py-4 rounded-full font-display font-medium text-lg hover:bg-accent-foreground/10 transition-all duration-300"
            >
              Ver como funciona
            </a>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
      >
        <div className="w-6 h-10 border-2 border-accent-foreground/30 rounded-full flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-primary rounded-full" />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
