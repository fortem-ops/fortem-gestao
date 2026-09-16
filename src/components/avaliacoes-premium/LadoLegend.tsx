interface LadoLegendProps {
  /** Quando true, mostra apenas os quadrados coloridos com tooltip. */
  compact?: boolean;
  className?: string;
}

const LADO_ESQ_COLOR = "#378ADD";
const LADO_DIR_COLOR = "#E8843C";

export function LadoLegend({ compact, className = "" }: LadoLegendProps) {
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} aria-label="Legenda de lados">
        <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--bio-ink-muted))]">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: LADO_ESQ_COLOR }}
            aria-hidden
          />
          <span title="Esquerdo">E</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--bio-ink-muted))]">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: LADO_DIR_COLOR }}
            aria-hidden
          />
          <span title="Direito">D</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-4 rounded-lg border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] px-3 py-2 ${className}`}
      aria-label="Legenda de lados"
    >
      <span className="text-[11px] text-[hsl(var(--bio-ink-muted))] uppercase tracking-wider">Lados</span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--bio-ink))]">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: LADO_ESQ_COLOR }}
          aria-hidden
        />
        E = Esquerdo
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--bio-ink))]">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: LADO_DIR_COLOR }}
          aria-hidden
        />
        D = Direito
      </span>
    </div>
  );
}

/**
 * Variante para gráficos da Evolução, em que a cor varia por métrica e o que
 * diferencia os lados é o estilo do traço: contínuo = esquerdo, tracejado = direito.
 */
export function LadoLegendTraco({ className = "" }: { className?: string }) {
  const amostra = (dashed: boolean) => (
    <svg width="26" height="8" viewBox="0 0 26 8" aria-hidden className="shrink-0">
      <line
        x1="1"
        y1="4"
        x2="25"
        y2="4"
        stroke="hsl(var(--bio-ink))"
        strokeWidth="2"
        strokeDasharray={dashed ? "5 4" : undefined}
      />
    </svg>
  );
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] px-3 py-2 ${className}`}
      aria-label="Legenda de lados"
    >
      <span className="text-[11px] text-[hsl(var(--bio-ink-muted))] uppercase tracking-wider">Lados</span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--bio-ink))]">
        {amostra(false)}
        Contínua = Esquerdo (E)
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--bio-ink))]">
        {amostra(true)}
        Tracejada = Direito (D)
      </span>
    </div>
  );
}
