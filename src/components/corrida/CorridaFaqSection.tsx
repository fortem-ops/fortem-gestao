import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "./ScrollReveal";

const faqs = [
  {
    q: "A camiseta oficial é obrigatória?",
    a: "Sim. A camiseta é fundamental para a identificação dos alunos, principalmente em treinos longos, provas e treinos de pista. Em situações de emergência, a identificação imediata como integrante da assessoria permite um suporte muito mais rápido e seguro.",
  },
  {
    q: "Como funciona o cancelamento?",
    a: "Você pode cancelar quando quiser. Em planos anuais, o cancelamento antes do fim do período gera multa de 15% sobre o valor do período não utilizado — o restante é devolvido. Inscrições em prova (cortesia ou pagas) não são estornadas em nenhuma hipótese, já que representam uma compra de inscrição já processada junto à organização da prova.",
  },
  {
    q: "Sou iniciante, consigo acompanhar?",
    a: "Sim. O acompanhamento é próximo, com os treinadores ajustando o plano ao seu nível desde o primeiro treino.",
  },
];

const CorridaFaqSection = () => (
  <section className="py-24 md:py-32 bg-muted/50">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-12">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Dúvidas</p>
        <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground">Perguntas frequentes</h2>
      </ScrollReveal>

      <ScrollReveal className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className="rounded-2xl bg-card border border-border shadow-card px-6"
            >
              <AccordionTrigger className="font-display text-left text-base md:text-lg font-medium text-foreground hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm md:text-base pb-6">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollReveal>
    </div>
  </section>
);

export default CorridaFaqSection;
