import { MapPin, Clock } from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./ScrollReveal";
import pistaRamiro from "@/assets/corrida/pista-ramiro-souto.jpg";
import orlaGuaiba from "@/assets/corrida/orla-guaiba.jpg";

const locations = [
  { id: "redencao", name: "Pista Ramiro Souto – Redenção", image: pistaRamiro, schedules: [{ days: "Terças", times: ["07h30"] }] },
  { id: "orla", name: "Orla do Guaíba", image: orlaGuaiba, schedules: [{ days: "Sábados", times: ["06h30 às 09h30"] }] },
];

const TrainingLocationsSection = () => {
  return (
    <section className="py-24 md:py-32 bg-muted/50">
      <div className="container mx-auto px-6">
        <ScrollReveal className="text-center mb-16">
          <p className="text-primary font-display font-semibold tracking-[0.2em] uppercase text-sm mb-4">Treinos Presenciais</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">Onde treinamos</h2>
        </ScrollReveal>

        <StaggerContainer staggerDelay={0.2} className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {locations.map((loc) => (
            <StaggerItem key={loc.id}>
              <div className="bg-card rounded-2xl shadow-card border border-border hover:shadow-card-hover transition-all duration-300 overflow-hidden">
                <div className="w-full h-48 overflow-hidden">
                  <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
                </div>

                <div className="p-8">
                  <div className="flex items-start gap-3 mb-6">
                    <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <h3 className="font-display text-xl font-semibold text-foreground">{loc.name}</h3>
                  </div>
                  <div className="space-y-4">
                    {loc.schedules.map((s) => (
                      <div key={s.days} className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground text-sm">{s.days}</p>
                          <p className="text-muted-foreground text-sm">{s.times.join(" · ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

      </div>
    </section>
  );
};

export default TrainingLocationsSection;
