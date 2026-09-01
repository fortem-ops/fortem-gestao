import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  { text: "Foi a primeira vez na minha vida que eu consegui ficar mais de 3 meses fazendo um trabalho de força.", author: "Felipe D., 3 anos de FORTEM" },
  { text: "Encontrei na Fortem um ambiente que eu consigo me sentir acolhida, que os equipamentos são bons e os professores atualizados.", author: "Jéssica R., 4 anos de FORTEM" },
  { text: "Aqui eu posso ser quem eu sou, do jeito que eu sou, independente de como sou.", author: "Eduardo A., 7 anos de FORTEM" },
];

const SocialProof = () => (
  <section className="py-20 bg-dark text-dark-foreground">
    <div className="container max-w-4xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-5 rounded-xl border border-dark-foreground/10 bg-dark-foreground/5">
            <Quote className="w-5 h-5 text-primary mb-3" />
            <p className="text-sm leading-relaxed mb-3">{t.text}</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 fill-primary text-primary" />)}
              </div>
              <span className="text-xs text-dark-foreground/50">{t.author}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default SocialProof;
