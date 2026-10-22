import type { AjusteFoto } from "@/lib/festaFotos";

export default function FotoAutor({ src, alt, ajuste }: { src: string; alt: string; ajuste: AjusteFoto }) {
  return (
    <div className="aspect-[4/5] w-full overflow-hidden">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover"
        style={{ objectPosition: `${ajuste.x}% ${ajuste.y}%`, transform: `scale(${ajuste.zoom})`, transformOrigin: `${ajuste.x}% ${ajuste.y}%` }} />
    </div>
  );
}
