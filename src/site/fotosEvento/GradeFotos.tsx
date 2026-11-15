import { useEffect, useRef, useState } from "react";
import { proximoLimite, urlGrade, FOTOS_POR_LOTE_GRADE } from "@/lib/fotosEventos";
import type { FotoPublica } from "./api";

const preCarregadas = new Set<string>();
/** Ao tocar numa foto, já começa a baixar a prévia de 1200px que a foto aberta mostra. */
export function preCarregarPrevia(url: string | null) {
  if (!url || preCarregadas.has(url)) return;
  preCarregadas.add(url);
  const img = new Image(); img.decoding = "async"; img.src = url;
}

/** Imagem da grade: miniatura; se faltar ou falhar, a prévia. */
function Miniatura({ f, pb }: { f: FotoPublica; pb: boolean }) {
  const [url, setUrl] = useState(urlGrade(f));
  useEffect(() => { setUrl(urlGrade(f)); }, [f]);
  if (!url) return null;
  return (
    <img src={url} alt="" loading="lazy" decoding="async" width={400} height={400} className={pb ? "fe-pb" : ""}
      onError={() => { if (f.url_previa && url !== f.url_previa) setUrl(f.url_previa); }} />
  );
}

/**
 * Grade progressiva: começa com 12 e mostra mais 12 quando o fim entra na tela.
 * Quando já mostrou tudo o que tem e o servidor tem mais, pede a próxima página (onMais).
 */
export default function GradeFotos({ fotos, pb, onAbrir, temMais = false, onMais }: {
  fotos: FotoPublica[]; pb: boolean; onAbrir: (i: number) => void; temMais?: boolean; onMais?: () => void;
}) {
  const [limite, setLimite] = useState(Math.min(FOTOS_POR_LOTE_GRADE, fotos.length));
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { setLimite((l) => Math.max(Math.min(FOTOS_POR_LOTE_GRADE, fotos.length), Math.min(l, fotos.length))); }, [fotos.length]);
  const faltaMostrar = limite < fotos.length;
  useEffect(() => {
    const el = fim.current;
    if (!el || (!faltaMostrar && !temMais) || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      if (faltaMostrar) setLimite((l) => proximoLimite(l, fotos.length));
      else onMais?.();
    }, { rootMargin: "400px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [faltaMostrar, temMais, onMais, fotos.length, limite]);
  return (
    <>
      <div className="fe-grade">
        {fotos.slice(0, limite).map((f, i) => (
          <button key={f.id} onPointerDown={() => preCarregarPrevia(f.url_previa)} onClick={() => onAbrir(i)} aria-label={`Abrir foto ${i + 1}`}>
            <Miniatura f={f} pb={pb} />
          </button>
        ))}
      </div>
      {(faltaMostrar || temMais) && <div ref={fim} className="fe-grade-fim" data-testid="grade-fim" aria-hidden />}
    </>
  );
}
