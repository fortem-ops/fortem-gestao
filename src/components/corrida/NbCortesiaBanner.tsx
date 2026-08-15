import { motion } from "framer-motion";
import { Check } from "lucide-react";

const BENEFICIOS = [
  "Inscrição da prova",
  "Briefing pré-prova",
  "Retiramos seu kit da prova",
  "Acesso à estrutura da Fortem no dia da prova",
];

/**
 * Abertura institucional da página /corrida: campanha NB 42k 2027.
 * Sem interações — a escolha de caminho acontece na seção seguinte.
 */
interface NbCortesiaBannerProps {
  logoTopOffset?: number;
}

const NbCortesiaBanner = ({ logoTopOffset = 0 }: NbCortesiaBannerProps) => {
  return (
    <section className="relative w-full overflow-hidden bg-accent py-20 md:py-28">
      {/* Watermark tipo número de peito */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
        <span className="font-display font-bold leading-none text-accent-foreground/10 text-[9rem] sm:text-[14rem] md:text-[20rem] tracking-tighter">
          42K
        </span>
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="flex flex-col items-center gap-2 md:gap-4 mb-6">
            <img
              src="/fortem-logo.png"
              alt="Fortem"
              className="h-7 md:h-10 w-auto max-w-[150px] md:max-w-[260px] object-contain"
              style={{ transform: `translateY(-${logoTopOffset}px)` }}
              loading="lazy"
            />
            <div className="flex items-center justify-center gap-2 md:gap-6 flex-wrap">
              <img src={nbLogo} alt="New Balance" className="h-8 md:h-14 w-auto" loading="lazy" />
              <span className="hidden sm:block h-6 md:h-8 w-px bg-accent-foreground/25" />
              <div className="inline-flex items-center justify-center gap-1 md:gap-3 flex-wrap sm:flex-nowrap">
                <span className="font-display font-bold uppercase tracking-[0.15em] md:tracking-[0.25em] text-accent-foreground text-lg md:text-3xl">
                  Porto Alegre
                </span>
                <span className="font-display font-bold text-primary text-lg md:text-3xl">2027</span>
              </div>
            </div>
          </div>

          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-accent-foreground leading-tight max-w-4xl mx-auto">
            Matricule-se agora e ganhe sua inscrição na{" "}
            <span className="text-primary">NB 42k 2027</span>.
          </h1>

          <p className="mt-6 text-lg md:text-2xl text-accent-foreground/80 font-light">
            Garanta sua vaga até 20/08.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3 opacity-80">
            <span className="text-[10px] uppercase tracking-[0.3em] text-accent-foreground/60">
              Prova oficial
            </span>
            <img src={nbLogo} alt="" className="h-6 md:h-7 w-auto" loading="lazy" />
          </div>

          <ul className="mt-10 grid sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto text-left">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-accent-foreground/90">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default NbCortesiaBanner;
