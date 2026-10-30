interface Props {
  descricao: string;
  /** Quando houver foto real, passe src e ela substitui o placeholder. */
  src?: string;
  className?: string;
}

/** Bloco de foto provisório (fundo escuro + colchetes vermelhos). */
export function PlaceholderFoto({ descricao, src, className = "aspect-[4/3]" }: Props) {
  if (src) {
    return <img src={src} alt={descricao} loading="lazy" decoding="async" className={`w-full object-cover ${className}`} />;
  }
  return (
    <div className={`sp-foto w-full ${className}`} role="img" aria-label={`Foto: ${descricao}`}>
      <span className="sp-canto tl" /><span className="sp-canto tr" />
      <span className="sp-canto bl" /><span className="sp-canto br" />
      <span className="sp-rotulo px-6 text-center">FOTO · {descricao}</span>
    </div>
  );
}
