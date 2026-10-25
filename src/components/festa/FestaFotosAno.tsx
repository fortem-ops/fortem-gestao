import { useEffect, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FestaFotoInteracao from "@/components/festa/FestaFotoInteracao";
import type { FestaInteracao } from "@/lib/festaInteracoes";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

type Foto = { id?: string; url: string; alt?: string | null };
type Props = { ano: string; fotos: Foto[]; proporcao?: string; interacoes?: Record<string, FestaInteracao>; onInteracao?: (id: string, i: FestaInteracao) => void };

/** Impede que o arrasto sobre as fotos chegue ao swipe de troca de capítulo. */
const parar = (e: TouchEvent) => e.stopPropagation();

const seta = "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(14,14,14,0.65)] text-[#ffffff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e73c3e]";

export default function FestaFotosAno({ ano, fotos, proporcao = "aspect-[4/3]", interacoes, onInteracao }: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!api) return;
    const on = () => setAtual(api.selectedScrollSnap());
    on(); api.on("select", on);
    return () => { api.off("select", on); };
  }, [api]);
  // Novo ano: volta para a primeira foto.
  useEffect(() => { api?.scrollTo(0, true); setAtual(0); }, [ano, api]);

  const barra = (f: Foto) => f.id && onInteracao ? <FestaFotoInteracao fotoId={f.id} info={interacoes?.[f.id]} onChange={(i) => onInteracao(f.id!, i)} /> : null;

  if (fotos.length === 1) {
    const f = fotos[0];
    return <div><img src={f.url} alt={f.alt ?? `FORTEM em ${ano}`} loading="lazy" className={`${proporcao} w-full bg-card object-contain`} />{barra(f)}</div>;
  }

  const teclas = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); api?.scrollPrev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); api?.scrollNext(); }
  };
  const ultima = fotos.length - 1;

  return (
    <div className="relative" role="region" aria-roledescription="carrossel" aria-label={`Fotos de ${ano}`} tabIndex={0} onKeyDown={teclas}
      onTouchStart={parar} onTouchMove={parar} onTouchEnd={parar}>
      <div className="relative" style={{ touchAction: "pan-y" }}>
        <Carousel setApi={setApi} opts={{ loop: false }}>
          <CarouselContent>
            {fotos.map((f, i) => (
              <CarouselItem key={f.url} aria-label={`Foto ${i + 1} de ${fotos.length}`}>
                <img src={f.url} alt={f.alt ?? `FORTEM em ${ano}`} loading={Math.abs(i - atual) <= 1 ? "eager" : "lazy"} decoding="async" draggable={false} className={`${proporcao} w-full select-none bg-card object-contain`} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {atual > 0 && (
          <button type="button" onClick={() => api?.scrollPrev()} aria-label="Foto anterior" className={`${seta} left-2`}><ChevronLeft className="h-6 w-6" /></button>
        )}
        {atual < ultima && (
          <button type="button" onClick={() => api?.scrollNext()} aria-label="Próxima foto" className={`${seta} right-2`}><ChevronRight className="h-6 w-6" /></button>
        )}
        <span className="pointer-events-none absolute bottom-2 right-2 bg-[rgba(14,14,14,0.65)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#ffffff]" aria-hidden>{atual + 1} / {fotos.length}</span>
      </div>
      {fotos[atual] && barra(fotos[atual])}
      <div className="mt-1 flex justify-center gap-2">
        {fotos.map((_, i) => (
          <button key={i} type="button" onClick={() => api?.scrollTo(i)} aria-label={`Ir para foto ${i + 1} de ${fotos.length}`} aria-current={i === atual}
            className={`h-1.5 w-6 ${i === atual ? "bg-[#e73c3e]" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
