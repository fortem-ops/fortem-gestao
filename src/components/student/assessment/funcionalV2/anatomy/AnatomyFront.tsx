/**
 * Vista anterior — anatomia biomecânica premium, monocromática.
 * ViewBox 200×540. Cada região avaliável é um <path id="region-{RegionId}">
 * para que halos e clip-paths possam referenciá-la em BodyMapSVG.
 */
export function AnatomyFront() {
  return (
    <g className="anatomy-front">
      <defs>
        {/* Sombreamento global para volume corporal */}
        <radialGradient id="bodyShadeFront" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0%" stopColor="hsl(var(--bodymap-muscle-hi))" stopOpacity="0.35" />
          <stop offset="60%" stopColor="hsl(var(--bodymap-muscle-base))" stopOpacity="0.0" />
          <stop offset="100%" stopColor="hsl(var(--bodymap-muscle-shade))" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* Cabeça */}
      <ellipse cx="100" cy="42" rx="20" ry="26" className="anatomy-skin" />
      <path d="M86,52 Q100,62 114,52 Q113,60 110,66 Q100,70 90,66 Q87,60 86,52 Z"
            fill="hsl(var(--bodymap-muscle-shade) / 0.35)" />
      {/* Pescoço */}
      <path d="M91,68 L91,86 Q100,92 109,86 L109,68 Z" className="anatomy-skin" />
      <path d="M96,72 L96,88 M104,72 L104,88" className="anatomy-line" />

      {/* Trapézio superior (visível anteriormente) */}
      <path d="M70,92 Q85,82 100,88 Q115,82 130,92 L122,98 Q100,94 78,98 Z"
            fill="hsl(var(--bodymap-muscle-base))" stroke="hsl(var(--bodymap-line) / 0.4)" strokeWidth="0.4" />

      {/* === OMBROS (deltoides anteriores) === */}
      <path id="region-shoulder-l"
            d="M68,92 Q52,96 46,114 Q44,128 50,140 Q58,138 64,130 Q68,118 70,104 Z"
            className="anatomy-muscle" />
      <path id="region-shoulder-r"
            d="M132,92 Q148,96 154,114 Q156,128 150,140 Q142,138 136,130 Q132,118 130,104 Z"
            className="anatomy-muscle" />
      {/* Highlights deltoides */}
      <path d="M55,100 Q50,114 53,128" className="anatomy-line" />
      <path d="M145,100 Q150,114 147,128" className="anatomy-line" />

      {/* Tórax / Peitoral */}
      <path d="M70,98 Q85,108 100,108 Q115,108 130,98 Q132,130 122,148 Q100,154 78,148 Q68,130 70,98 Z"
            className="anatomy-muscle" />
      <path d="M100,108 L100,150" className="anatomy-line" />
      <path d="M76,118 Q88,132 96,144" className="anatomy-line" />
      <path d="M124,118 Q112,132 104,144" className="anatomy-line" />

      {/* Braços (bíceps + tríceps lateral) */}
      <path d="M46,134 Q40,170 44,206 L56,206 Q60,178 62,142 Z" className="anatomy-muscle" />
      <path d="M154,134 Q160,170 156,206 L144,206 Q140,178 138,142 Z" className="anatomy-muscle" />
      <path d="M48,150 Q46,180 50,200" className="anatomy-line" />
      <path d="M152,150 Q154,180 150,200" className="anatomy-line" />
      {/* Antebraços */}
      <path d="M44,208 Q40,248 46,288 L56,288 Q58,250 56,208 Z" className="anatomy-muscle" />
      <path d="M156,208 Q160,248 154,288 L144,288 Q142,250 144,208 Z" className="anatomy-muscle" />
      {/* Mãos */}
      <ellipse cx="50" cy="296" rx="9" ry="11" className="anatomy-skin" />
      <ellipse cx="150" cy="296" rx="9" ry="11" className="anatomy-skin" />

      {/* Abdômen — reto abdominal */}
      <path d="M82,148 Q80,180 82,212 Q90,222 100,222 Q110,222 118,212 Q120,180 118,148 Z"
            className="anatomy-muscle" />
      <path d="M100,150 L100,220" className="anatomy-line" />
      <path d="M84,168 L116,168 M84,184 L116,184 M86,200 L114,200" className="anatomy-line" />
      {/* Oblíquos */}
      <path d="M70,150 Q66,180 72,215 L82,215 Q80,180 80,150 Z" className="anatomy-shade" />
      <path d="M130,150 Q134,180 128,215 L118,215 Q120,180 120,150 Z" className="anatomy-shade" />

      {/* === QUADRIL (vista anterior — crista ilíaca + EIAS) === */}
      <path id="region-hip-l"
            d="M64,232 Q60,260 68,288 Q80,294 90,288 Q92,262 88,232 Z"
            className="anatomy-muscle" />
      <path id="region-hip-r"
            d="M136,232 Q140,260 132,288 Q120,294 110,288 Q108,262 112,232 Z"
            className="anatomy-muscle" />
      <path d="M68,240 Q78,248 88,248" className="anatomy-line" />
      <path d="M132,240 Q122,248 112,248" className="anatomy-line" />

      {/* Virilha */}
      <path d="M90,290 Q100,302 110,290 L100,310 Z" className="anatomy-shade" />

      {/* === QUADRÍCEPS (com psoas/reto femoral, vastos medial/lateral) === */}
      <path id="region-quad-l"
            d="M62,300 Q56,346 58,398 Q66,408 80,408 Q92,406 94,396 Q94,344 92,300 Z"
            className="anatomy-muscle" />
      <path id="region-quad-r"
            d="M138,300 Q144,346 142,398 Q134,408 120,408 Q108,406 106,396 Q106,344 108,300 Z"
            className="anatomy-muscle" />
      {/* Linhas: reto femoral central + vastos */}
      <path d="M78,308 Q76,350 78,398" className="anatomy-line" />
      <path d="M64,322 Q62,360 70,396" className="anatomy-line" />
      <path d="M90,318 Q92,358 88,400" className="anatomy-line" />
      <path d="M122,308 Q124,350 122,398" className="anatomy-line" />
      <path d="M136,322 Q138,360 130,396" className="anatomy-line" />
      <path d="M110,318 Q108,358 112,400" className="anatomy-line" />
      {/* Sombreamento lateral (vasto lateral) */}
      <path d="M60,310 Q56,360 58,396 L66,396 Q66,360 64,310 Z" className="anatomy-shade" />
      <path d="M140,310 Q144,360 142,396 L134,396 Q134,360 136,310 Z" className="anatomy-shade" />

      {/* Joelhos */}
      <path d="M62,410 Q58,420 64,432 L92,432 Q96,420 92,410 Z" className="anatomy-muscle" />
      <path d="M138,410 Q142,420 136,432 L108,432 Q104,420 108,410 Z" className="anatomy-muscle" />
      <ellipse cx="78" cy="422" rx="9" ry="6" className="anatomy-shade" />
      <ellipse cx="122" cy="422" rx="9" ry="6" className="anatomy-shade" />

      {/* Tibial anterior + canela */}
      <path d="M64,434 Q60,468 64,496 L92,496 Q94,468 90,434 Z" className="anatomy-muscle" />
      <path d="M136,434 Q140,468 136,496 L108,496 Q106,468 110,434 Z" className="anatomy-muscle" />
      <path d="M78,442 Q76,470 78,494" className="anatomy-line" />
      <path d="M122,442 Q124,470 122,494" className="anatomy-line" />

      {/* === TORNOZELOS === */}
      <path id="region-ankle-l"
            d="M66,496 Q62,510 68,516 L88,516 Q92,510 90,496 Z"
            className="anatomy-muscle" />
      <path id="region-ankle-r"
            d="M134,496 Q138,510 132,516 L112,516 Q108,510 110,496 Z"
            className="anatomy-muscle" />

      {/* Pés */}
      <path d="M66,516 L90,516 Q94,526 88,532 Q74,534 64,528 Z" className="anatomy-skin" />
      <path d="M134,516 L110,516 Q106,526 112,532 Q126,534 136,528 Z" className="anatomy-skin" />

      {/* Sombreamento global */}
      <rect x="0" y="0" width="200" height="540" fill="url(#bodyShadeFront)" opacity="0.4" pointerEvents="none" />
    </g>
  );
}
