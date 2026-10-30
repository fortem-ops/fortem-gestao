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

/** Bloco de foto provisório (fundo escuro + colchetes vermelhos). */
export function PlaceholderFoto({ descricao, src, srcSet, sizes, width = 1200, height = 900, prioridade, className = "" }: Props) {
  return (
    <div className={`sp-foto w-full ${className || (src ? "" : "aspect-[4/3]")}`} role={src ? undefined : "img"} aria-label={src ? undefined : descricao}>
      {src && <img src={src} srcSet={srcSet} sizes={sizes} alt={descricao} width={width} height={height}
        loading={prioridade ? "eager" : "lazy"} decoding="async" fetchPriority={prioridade ? "high" : undefined}
        className={className ? "absolute inset-0 h-full w-full object-cover" : "block h-auto w-full object-cover"} />}
      <span className="sp-canto tl" aria-hidden /><span className="sp-canto tr" aria-hidden />
      <span className="sp-canto bl" aria-hidden /><span className="sp-canto br" aria-hidden />
      {!src && <span className="sp-rotulo px-6 text-center" aria-hidden>FOTO · {descricao}</span>}
    </div>
  );
}
