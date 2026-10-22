import { useEffect, useRef } from "react";

type Props = { anos: string[]; ativo?: string; onIr: (ano: string) => void; anoAtual?: number };

/** Trilha horizontal de anos (mobile): centraliza o ano ativo e leva ao capítulo ao tocar. */
export default function TrilhaAnos({ anos, ativo, onIr, anoAtual = new Date().getFullYear() }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, anos.indexOf(ativo ?? ""));

  useEffect(() => {
    const el = ref.current; const btn = el?.querySelector<HTMLElement>(`[data-ano="${ativo}"]`);
    if (!el || !btn || typeof el.scrollTo !== "function") return;
    const r = btn.getBoundingClientRect(), c = el.getBoundingClientRect();
    el.scrollTo({ left: el.scrollLeft + (r.left + r.width / 2) - (c.left + c.width / 2), behavior: "smooth" });
  }, [ativo]);

  return (
    <div data-trilha className="sticky top-[52px] z-20 mt-14 h-[76px] border-y border-card bg-background md:hidden">
      <div className="flex items-center justify-between h-[18px] px-5 pt-1.5 text-[10px] leading-none font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span>Trajetória</span><span aria-live="polite">{idx + 1} de {anos.length}</span>
      </div>
      <div ref={ref} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ scrollBehavior: "smooth" }}>
        <ol className="flex px-[calc(50%-36px)] pb-0" aria-label="Anos da história">
          {anos.map((ano, i) => {
            const passado = i < idx, atual = i === idx, futuro = Number(ano) > anoAtual, ultimo = i === anos.length - 1;
            const ponto = atual ? "h-5 w-5 festa-marca-bg festa-trilha-ponto-ativo"
              : passado ? "h-3.5 w-3.5 festa-marca-bg"
              : `h-3.5 w-3.5 border-2 bg-background ${futuro ? "border-muted-foreground" : "border-border"}`;
            return (
              <li key={ano} className="relative w-[72px] shrink-0">
                {!ultimo && !futuro && <span aria-hidden className={`absolute left-1/2 top-[18px] h-[2px] w-full -translate-y-1/2 ${i < idx ? "festa-marca-bg" : "bg-border"}`} />}
                <button type="button" data-ano={ano} aria-label={`Ir para ${ano}`} aria-current={atual ? "step" : undefined} onClick={() => onIr(ano)}
                  className="relative flex h-[56px] w-full flex-col items-center justify-start gap-1 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex h-5 items-center"><span aria-hidden className={`festa-trilha-ponto block ${ponto}`} /></span>
                  <span className={`transition-all ${atual ? "text-base font-bold text-foreground" : futuro ? "text-xs text-muted-foreground" : "text-xs text-muted-foreground"}`}>{ano}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
