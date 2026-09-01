import { motion } from "framer-motion";
import { Users } from "lucide-react";

const HeroSection = () => (
  <section className="min-h-[70vh] flex items-center justify-center relative overflow-hidden bg-dark">
    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
    <div className="container relative z-10 text-center px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
          <span className="text-sm font-medium text-dark-foreground/80">Monte seu plano em menos de 1 minuto</span>
        </motion.div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black text-dark-foreground leading-[1.1] tracking-tight mb-6">
          Há 10 anos, sendo a curadoria completa em{" "}
          <span className="text-gradient">Saúde e Performance</span>
        </h1>
        <p className="text-lg sm:text-xl text-dark-foreground/60 max-w-xl mx-auto mb-10 leading-relaxed font-light">
          Uma equipe multidisciplinar em treinamento, nutrição e reabilitação para te levar aos teus objetivos.
        </p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 flex items-center justify-center gap-2 text-dark-foreground/40">
          <Users className="w-4 h-4" />
          <span className="text-sm">+180 alunos treinando na Fortem</span>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
