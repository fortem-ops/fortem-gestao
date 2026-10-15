import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

type Foto = { url: string; alt?: string | null };

export default function FestaFotosAno({ ano, fotos, proporcao = "aspect-[4/3]" }: { ano: string; fotos: Foto[]; proporcao?: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!api) return;
    const on = () => setAtual(api.selectedScrollSnap());
    on(); api.on("select", on);
    return () => { api.off("select", on); };
  }, [api]);

  if (fotos.length === 1) {
    const f = fotos[0];
    return <img src={f.url} alt={f.alt ?? `FORTEM em ${ano}`} loading="lazy" className={`${proporcao} w-full bg-card object-contain`} />;
  }

  return (
    <div className="relative" aria-roledescription="carrossel" aria-label={`Fotos de ${ano}`}>
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {fotos.map((f, i) => (
            <CarouselItem key={f.url} aria-label={`Foto ${i + 1} de ${fotos.length}`}>
              <img src={f.url} alt={f.alt ?? `FORTEM em ${ano}`} loading="lazy" draggable={false} className={`${proporcao} w-full select-none bg-card object-contain`} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 hidden rounded-none md:flex" aria-label="Foto anterior" />
        <CarouselNext className="right-2 hidden rounded-none md:flex" aria-label="Próxima foto" />
      </Carousel>
      <div className="mt-3 flex justify-center gap-2">
        {fotos.map((_, i) => (
          <button key={i} type="button" onClick={() => api?.scrollTo(i)} aria-label={`Ir para foto ${i + 1} de ${fotos.length}`} aria-current={i === atual}
            className={`h-1.5 w-6 ${i === atual ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
