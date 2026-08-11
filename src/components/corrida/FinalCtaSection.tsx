import { ScrollReveal } from "./ScrollReveal";
import { motion } from "framer-motion";

const FinalCtaSection = ({ onCtaClick }: { onCtaClick: () => void }) => (
  <section className="py-24 md:py-32 bg-accent text-accent-foreground">
    <div className="container mx-auto px-6 text-center">
      <ScrollReveal>
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
          Pronto para começar a correr<br /><span className="text-gradient">com a Fortem?</span>
        </h2>
        <p className="text-accent-foreground/60 text-lg mb-10 max-w-lg mx-auto">
          Monte seu plano, escolha seu kit e entre para a comunidade.
        </p>
        <motion.button
          onClick={onCtaClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-display font-semibold text-lg glow-red"
        >
          Confirmar minha inscrição
        </motion.button>
        <div className="flex justify-center gap-8 mt-12 text-accent-foreground/40 text-sm">
          <span>1. Revisar plano</span>
          <span>2. Inserir dados</span>
          <span>3. Pagamento</span>
          <span>4. Confirmação</span>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default FinalCtaSection;
