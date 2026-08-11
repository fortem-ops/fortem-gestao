import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "./ScrollReveal";

const stats = [
  { value: 500, suffix: "+", label: "Alunos treinados" },
  { value: 10, suffix: "+", label: "Anos de experiência" },
  { value: 100, suffix: "+", label: "Provas concluídas" },
];

const AnimatedNumber = ({ target, suffix }: { target: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1500;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="font-display text-5xl md:text-6xl font-bold text-foreground">
      {count}{suffix}
    </div>
  );
};

const SocialProofSection = () => (
  <section className="py-24 md:py-32 bg-muted/50">
    <div className="container mx-auto px-6">
      <ScrollReveal>
        <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <AnimatedNumber target={stat.value} suffix={stat.suffix} />
              <p className="text-muted-foreground mt-2 text-sm md:text-base">{stat.label}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default SocialProofSection;
