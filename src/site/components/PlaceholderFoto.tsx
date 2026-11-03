import type { CSSProperties } from "react";
import { chaveDoSrc, useAjustesFotosSite, variaveisCss } from "../fotosAjuste";

interface Props {
  descricao: string;
  /** Quando houver foto real, passe src (e opcionalmente srcSet/sizes) e ela substitui o placeholder. */
  src?: string;
  srcSet?: string;
  sizes?: string;
  /** Dimensões intrínsecas da imagem (evitam salto de layout). */
  width?: number;
  height?: number;
  /** Use true só na foto principal acima da dobra. */
  prioridade?: boolean;
  className?: string;
}

/** Bloco de foto (fundo escuro + colchetes vermelhos), com ajuste fino salvo pela equipe. */
export function PlaceholderFoto({ descricao, src, srcSet, sizes, width = 1200, height = 900, prioridade, className = "" }: Props) {
  const { data: ajustes } = useAjustesFotosSite();
  const chave = chaveDoSrc(src);
  const ajuste = chave ? ajustes?.[chave] : undefined;
  const srcFinal = ajuste?.src ?? src;
  const trocada = !!ajuste?.src;
  const estilo = ajuste ? (variaveisCss(ajuste) as CSSProperties) : undefined;
  return (
    <div className={`sp-foto w-full ${className || (srcFinal ? "" : "aspect-[4/3]")}`} role={srcFinal ? undefined : "img"} aria-label={srcFinal ? undefined : descricao}
      style={!className && trocada ? { aspectRatio: `${width} / ${height}` } : undefined}>
      {srcFinal && <img src={srcFinal} srcSet={trocada ? undefined : srcSet} sizes={sizes} alt={descricao} width={width} height={height}
        loading={prioridade ? "eager" : "lazy"} decoding="async" fetchPriority={prioridade ? "high" : undefined} style={estilo}
        className={className || trocada ? "absolute inset-0 h-full w-full object-cover" : "block h-auto w-full object-cover"} />}
      <span className="sp-canto tl" aria-hidden /><span className="sp-canto tr" aria-hidden />
      <span className="sp-canto bl" aria-hidden /><span className="sp-canto br" aria-hidden />
      {!srcFinal && <span className="sp-rotulo px-6 text-center" aria-hidden>FOTO · {descricao}</span>}
    </div>
  );
}
