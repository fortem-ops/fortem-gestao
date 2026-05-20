/**
 * Vista posterior — anatomia biomecânica premium, monocromática.
 * ViewBox 200×540. Cada região avaliável é um <path id="region-{RegionId}">.
 */
export function AnatomyBack() {
  return (
    <g className="anatomy-back">
      <defs>
        <radialGradient id="bodyShadeBack" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0%" stopColor="hsl(var(--bodymap-muscle-hi))" stopOpacity="0.3" />
          <stop offset="60%" stopColor="hsl(var(--bodymap-muscle-base))" stopOpacity="0.0" />
          <stop offset="100%" stopColor="hsl(var(--bodymap-muscle-shade))" stopOpacity="0.65" />
        </radialGradient>
      </defs>

      {/* Cabeça (occipital) */}
      <ellipse cx="100" cy="42" rx="20" ry="26" className="anatomy-skin" />
      <path d="M90,40 Q100,32 110,40 Q108,52 100,56 Q92,52 90,40 Z" className="anatomy-shade" />
      {/* Pescoço */}
      <path d="M91,68 L91,86 Q100,92 109,86 L109,68 Z" className="anatomy-skin" />

      {/* Trapézio (forma de diamante) */}
      <path d="M70,90 Q100,82 130,90 Q124,134 100,156 Q76,134 70,90 Z"
            className="anatomy-muscle" />
      <path d="M100,86 L100,156" className="anatomy-line" />
      <path d="M82,100 Q92,124 100,150" className="anatomy-line" />
      <path d="M118,100 Q108,124 100,150" className="anatomy-line" />

      {/* === OMBROS (deltoides posteriores) === */}
      <path id="region-shoulder-l"
            d="M68,92 Q52,98 46,116 Q44,130 50,142 Q60,138 66,128 Q70,114 70,98 Z"
            className="anatomy-muscle" />
      <path id="region-shoulder-r"
            d="M132,92 Q148,98 154,116 Q156,130 150,142 Q140,138 134,128 Q130,114 130,98 Z"
            className="anatomy-muscle" />
      <path d="M55,104 Q52,118 56,134" className="anatomy-line" />
      <path d="M145,104 Q148,118 144,134" className="anatomy-line" />

      {/* === COLUNA TORÁCICA === */}
      <path id="region-thoracic"
            d="M84,98 Q78,140 84,200 L116,200 Q122,140 116,98 Q100,104 84,98 Z"
            className="anatomy-muscle" />
      {/* Eretores espinhais */}
      <path d="M92,108 Q90,150 94,198" className="anatomy-line" />
      <path d="M108,108 Q110,150 106,198" className="anatomy-line" />
      <path d="M100,100 L100,200" className="anatomy-line" />
      {/* Latíssimo (lados) */}
      <path d="M70,150 Q66,180 74,212 L84,200 Q82,170 84,148 Z" className="anatomy-shade" />
      <path d="M130,150 Q134,180 126,212 L116,200 Q118,170 116,148 Z" className="anatomy-shade" />

      {/* Braços (tríceps) */}
      <path d="M46,134 Q40,170 44,206 L56,206 Q60,178 62,142 Z" className="anatomy-muscle" />
      <path d="M154,134 Q160,170 156,206 L144,206 Q140,178 138,142 Z" className="anatomy-muscle" />
      <path d="M50,148 Q48,180 52,202" className="anatomy-line" />
      <path d="M150,148 Q152,180 148,202" className="anatomy-line" />
      <path d="M44,208 Q40,248 46,288 L56,288 Q58,250 56,208 Z" className="anatomy-muscle" />
      <path d="M156,208 Q160,248 154,288 L144,288 Q142,250 144,208 Z" className="anatomy-muscle" />
      <ellipse cx="50" cy="296" rx="9" ry="11" className="anatomy-skin" />
      <ellipse cx="150" cy="296" rx="9" ry="11" className="anatomy-skin" />

      {/* === LOMBAR === */}
      <path id="region-lumbar"
            d="M82,206 Q78,232 82,260 L118,260 Q122,232 118,206 Q100,210 82,206 Z"
            className="anatomy-muscle" />
      <path d="M94,212 Q92,236 96,258" className="anatomy-line" />
      <path d="M106,212 Q108,236 104,258" className="anatomy-line" />

      {/* === GLÚTEOS (visualmente mapeados ao quadril) === */}
      <path id="region-hip-l"
            d="M64,262 Q56,296 72,318 Q88,322 96,310 Q98,284 92,262 Z"
            className="anatomy-muscle" />
      <path id="region-hip-r"
            d="M136,262 Q144,296 128,318 Q112,322 104,310 Q102,284 108,262 Z"
            className="anatomy-muscle" />
      <path d="M76,278 Q72,300 82,316" className="anatomy-line" />
      <path d="M124,278 Q128,300 118,316" className="anatomy-line" />
      <path d="M100,262 L100,318" className="anatomy-line" />

      {/* === POSTERIOR DE COXA (isquiotibiais) === */}
      <path id="region-ham-l"
            d="M62,320 Q56,366 60,408 Q72,414 86,410 Q94,366 92,320 Z"
            className="anatomy-muscle" />
      <path id="region-ham-r"
            d="M138,320 Q144,366 140,408 Q128,414 114,410 Q106,366 108,320 Z"
            className="anatomy-muscle" />
      {/* Bíceps femoral / semitendinoso / semimembranoso */}
      <path d="M70,330 Q66,370 70,406" className="anatomy-line" />
      <path d="M82,330 Q82,370 80,406" className="anatomy-line" />
      <path d="M130,330 Q134,370 130,406" className="anatomy-line" />
      <path d="M118,330 Q118,370 120,406" className="anatomy-line" />
      <path d="M78,326 L78,408" className="anatomy-line" opacity="0.5" />
      <path d="M122,326 L122,408" className="anatomy-line" opacity="0.5" />

      {/* Cavo poplíteo (atrás do joelho) */}
      <path d="M62,410 Q58,420 64,432 L92,432 Q96,420 92,410 Z" className="anatomy-shade" />
      <path d="M138,410 Q142,420 136,432 L108,432 Q104,420 108,410 Z" className="anatomy-shade" />

      {/* Gastrocnêmio (panturrilha) */}
      <path d="M64,434 Q56,468 64,496 L92,496 Q96,468 90,434 Z" className="anatomy-muscle" />
      <path d="M136,434 Q144,468 136,496 L108,496 Q104,468 110,434 Z" className="anatomy-muscle" />
      {/* Linha medial gastro */}
      <path d="M78,440 Q76,470 78,494" className="anatomy-line" />
      <path d="M122,440 Q124,470 122,494" className="anatomy-line" />
      <path d="M68,448 Q62,470 70,490" className="anatomy-shade" />
      <path d="M132,448 Q138,470 130,490" className="anatomy-shade" />

      {/* === TORNOZELOS (calcâneo) === */}
      <path id="region-ankle-l"
            d="M66,496 Q62,512 70,518 L86,518 Q92,512 90,496 Z"
            className="anatomy-muscle" />
      <path id="region-ankle-r"
            d="M134,496 Q138,512 130,518 L114,518 Q108,512 110,496 Z"
            className="anatomy-muscle" />

      {/* Calcanhares */}
      <path d="M68,518 L88,518 Q90,528 84,532 Q72,532 66,526 Z" className="anatomy-skin" />
      <path d="M132,518 L112,518 Q110,528 116,532 Q128,532 134,526 Z" className="anatomy-skin" />

      {/* Linha vertebral central marcadora */}
      <line x1="100" y1="92" x2="100" y2="262" stroke="hsl(var(--bodymap-line) / 0.45)"
            strokeWidth="0.6" strokeDasharray="2 3" />

      <rect x="0" y="0" width="200" height="540" fill="url(#bodyShadeBack)" opacity="0.4" pointerEvents="none" />
    </g>
  );
}
