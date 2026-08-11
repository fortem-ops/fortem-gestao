import { motion } from "framer-motion";

/**
 * Banner de destaque da campanha: cortesia de inscrição na NB 42k 2027.
 * Full-width, alto contraste. Sem logomarcas de terceiros — apenas texto.
 */
const NbCortesiaBanner = ({ onCtaClick }: { onCtaClick: () => void }) => {
  return (
    <section className="relative w-full overflow-hidden bg-accent py-20 md:py-28">
      {/* Watermark tipo número de peito */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
        <span className="font-display font-bold leading-none text-accent-foreground/10 text-[9rem] sm:text-[14rem] md:text-[20rem] tracking-tighter">
          42K
        </span>
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 md:gap-5 mb-6 flex-wrap">
            <span className="font-display font-bold uppercase tracking-[0.25em] text-accent-foreground text-xl md:text-3xl">
              Porto Alegre
            </span>
            <span className="font-display font-bold text-primary text-xl md:text-3xl">2027</span>
          </div>

          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-accent-foreground leading-tight max-w-4xl mx-auto">
            Matricule-se agora e ganhe sua inscrição na{" "}
            <span className="text-primary">NB 42k 2027</span>.
          </h2>

          <p className="mt-6 text-lg md:text-2xl text-accent-foreground/80 font-light max-w-3xl mx-auto">
            Nenhuma assessoria de Porto Alegre oferece isso. Garanta sua vaga até 20/08.
          </p>

          <button
            onClick={onCtaClick}
            className="mt-10 bg-primary text-primary-foreground px-8 py-4 rounded-full font-display font-semibold text-lg hover:scale-105 transition-all duration-300 glow-red"
          >
            Montar meu plano de corrida
          </button>

          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-accent-foreground/50">
            Prova em parceria com New Balance
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default NbCortesiaBanner;
