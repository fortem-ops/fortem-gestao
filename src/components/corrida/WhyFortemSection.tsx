import { ScrollReveal } from "./ScrollReveal";

const stats = [
  { value: "10", suffix: " anos", label: "de história da Fortem" },
  { value: "+2.000", suffix: "", label: "atendidos ao longo desses 10 anos" },
  { value: "+180", suffix: "", label: "sendo acompanhados atualmente" },
];

const WhyFortemSection = () => (
  <section className="py-24 md:py-32 bg-background">
    <div className="container mx-auto px-6">
      <ScrollReveal className="text-center mb-14">
        <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">
          Por que a Fortem
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-medium text-foreground">
          Assessoria nova.<br />Estrutura madura.
        </h2>
      </ScrollReveal>

      <ScrollReveal className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-card border border-border shadow-card p-8 text-center"
            >
              <div className="font-display text-5xl md:text-6xl font-bold text-foreground">
                {s.value}
                <span className="text-primary">{s.suffix}</span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-8 text-center">
          <p className="text-muted-foreground text-base md:text-lg">
            A Assessoria de Corrida está no seu primeiro ano — mas ela nasce dentro de uma
            estrutura já madura. A Fortem já oferece Treinamento (Academia e Corrida),
            Nutrição e Reabilitação sob o mesmo teto, com a mesma equipe cuidando de você
            de ponta a ponta.
          </p>
          <p className="mt-6 inline-block text-xs md:text-sm uppercase tracking-[0.25em] text-primary font-display font-semibold border border-primary/30 rounded-full px-5 py-2">
            Inteligência em Saúde Integrada
          </p>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default WhyFortemSection;
