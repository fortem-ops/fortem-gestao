import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export const tempo = (s?: number | null) => {
  if (!s || !isFinite(s) || s < 0) return "0:00";
  const t = Math.floor(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Player próprio da Introdução: sem controles nativos (sem baixar), áudio só carrega ao tocar. */
export default function PlayerIntroducao({ src, duracaoPadrao = 108 }: { src: string; duracaoPadrao?: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [dur, setDur] = useState(duracaoPadrao);
  const alternar = () => {
    const a = ref.current; if (!a) return;
    if (a.paused) { document.querySelectorAll("audio").forEach((o) => o !== a && o.pause()); a.play().catch(() => setTocando(false)); }
    else a.pause();
  };
  const pct = dur ? Math.min(100, (atual / dur) * 100) : 0;
  return (
    <div className="flex items-center gap-3 border border-[#4a4b4b] bg-[#1a1b1b] pr-3">
      <audio ref={ref} src={src} preload="none" className="hidden" data-testid="audio-introducao"
        onPlay={() => setTocando(true)} onPause={() => setTocando(false)} onEnded={() => { setTocando(false); setAtual(0); }}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)} />
      <button type="button" onClick={alternar} aria-label={tocando ? "Pausar introdução" : "Tocar introdução"} aria-pressed={tocando}
        className="festa-marca-bg flex h-12 w-12 shrink-0 items-center justify-center text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        {tocando ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Ouça a introdução</p>
        <div className="mt-2 h-1 w-full bg-[#4a4b4b]" aria-hidden><div className="festa-marca-bg h-full" style={{ width: `${pct}%` }} /></div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{tempo(atual)} / {tempo(dur)}</span>
    </div>
  );
}
