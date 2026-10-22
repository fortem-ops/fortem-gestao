import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { festa10AnosConfig as cfg } from "@/config/festa10anos";
import { brlCentavos } from "@/lib/festa10anos";
import { Seo } from "@/components/Seo";
import FestaConfirmacaoForm from "@/components/festa/FestaConfirmacaoForm";
import FestaFotosAno from "@/components/festa/FestaFotosAno";
import FotoAutor from "@/components/festa/FotoAutor";
import { agruparFotosPorAno, carregarFestaFotosPublico, carregarAjusteAutorPublico, AJUSTE_PADRAO, type AjusteFoto, type FestaFoto } from "@/lib/festaFotos";
import { carregarInteracoes, type FestaInteracao } from "@/lib/festaInteracoes";
import { festaHistoriaAbertura as ab, festaHistoriaCapitulos, minutosLeitura, type Capitulo } from "@/config/festaHistoria";
import TrilhaAnos from "@/components/festa/TrilhaAnos";
import { useIsMobile } from "@/hooks/use-mobile";
import { carregarFestaAudios, textoDuracao, type FestaAudio } from "@/lib/festaAudios";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import PlayerIntroducao, { tempo } from "@/components/festa/PlayerIntroducao";
import { Pause, Play } from "lucide-react";

/** Duas cantoneiras em diagonal (superior esquerda e inferior direita). */
function Cantoneiras({ cor = "border-foreground" }: { cor?: string }) {
  return (
    <>
      <span aria-hidden className={`pointer-events-none absolute -left-2 -top-2 h-6 w-6 border-l-2 border-t-2 ${cor}`} />
      <span aria-hidden className={`pointer-events-none absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 ${cor}`} />
    </>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.28em] festa-marca">{children}</p>;
}

const linkCls = "inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnPrim = "inline-flex min-h-12 items-center justify-center bg-primary px-7 text-[13px] font-bold uppercase tracking-[0.12em] text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-sm";
const btnSec = "inline-flex min-h-12 items-center justify-center border-2 border-foreground px-7 text-[13px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

export default function Festa10Anos() {
  const [totalConfirmados, setTotalConfirmados] = useState<number | null>(null);

  const carregarTotal = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_festa_total_confirmados" as any);
    if (!error && typeof data === "number") setTotalConfirmados(data);
  }, []);
  useEffect(() => { carregarTotal(); }, [carregarTotal]);
  const [fotosDb, setFotosDb] = useState<Record<string, FestaFoto[]> | null>(null);
  useEffect(() => { carregarFestaFotosPublico().then((f) => setFotosDb(agruparFotosPorAno(f))).catch(() => setFotosDb(null)); carregarAjusteAutorPublico().then(setAjusteAutor).catch(() => {}); }, []);
  const [ajusteAutor, setAjusteAutor] = useState<AjusteFoto>(AJUSTE_PADRAO);

  const [audiosDb, setAudiosDb] = useState<Record<string, FestaAudio>>({});
  useEffect(() => { carregarFestaAudios().then(setAudiosDb).catch(() => {}); }, []);
  const [interacoes, setInteracoes] = useState<Record<string, FestaInteracao>>({});
  useEffect(() => { carregarInteracoes().then(setInteracoes).catch(() => {}); }, []);
  const onInteracao = useCallback((id: string, i: FestaInteracao) => setInteracoes((m) => ({ ...m, [id]: i })), []);

  const local = `${cfg.local.endereco} · ${cfg.horario} · confirmações ${cfg.prazoTexto}`;

  return (
    <main data-festa="10anos" className="min-h-screen overflow-x-clip bg-background font-light text-foreground">
      <Seo title="FORTEM · 10 anos | 14.11.26" description="Dez anos de movimento. Confirme sua presença na festa de 10 anos da FORTEM, em 14 de novembro de 2026." path="/10anos" />

      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-[51px] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 md:h-auto md:py-3">
          <a href="#topo" aria-label="FORTEM, início" className="inline-flex min-h-11 items-center"><img src={fortemWordmark} alt="FORTEM" className="h-[22px] w-auto invert md:h-6" /></a>
          <nav aria-label="Seções" className="flex items-center gap-1 sm:gap-4">
            <a href="#historia" className={`${linkCls} hidden md:inline-flex`}>História</a>
            <a href="#festa" className={`${linkCls} hidden md:inline-flex`}>A festa</a>
            <a href="#confirmar" className="inline-flex h-11 items-center bg-primary px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-auto md:min-h-11 md:px-4 md:text-xs md:tracking-[0.12em]">Confirmar presença</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="topo" className="px-5 py-8 sm:px-8 md:py-24 lg:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-6 sm:gap-x-8 md:gap-y-10 lg:grid-cols-[1.3fr_1fr] lg:gap-x-14 lg:gap-y-8">
          <div className="col-start-1 row-start-1">
            <h1 className="text-[44px] font-black leading-[0.85] md:text-8xl lg:text-[9rem]">{cfg.dataCurta}</h1>
          </div>
          <div className="relative mx-auto aspect-square w-16 self-center md:w-[9rem] lg:row-span-2 lg:w-full lg:max-w-[26rem]">
            <Cantoneiras />
            <div className="festa-marca-bg flex h-full w-full items-center justify-center">
              <span className="text-[38px] font-black leading-none text-foreground md:text-[6rem] lg:text-[13rem]">10</span>
            </div>
          </div>
          <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <p className="text-[22px] font-extrabold uppercase tracking-[0.06em] md:text-3xl">{cfg.hero.titulo}</p>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground md:mt-4 md:text-lg">{cfg.hero.texto}</p>
            <div className="mt-5 md:max-w-md">
              <PlayerIntroducao src="/audio/10anos/introducao.m4a" />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row md:mt-9">
              <a href="#confirmar" className={btnPrim}>Confirmar presença</a>
              <a href="#historia" className={btnSec}>Nossa história</a>
            </div>
            <p className="mt-5 text-sm text-muted-foreground md:mt-8">{local}</p>
          </div>
        </div>
      </section>


      <NossaHistoria audiosDb={audiosDb} ajusteAutor={ajusteAutor} fotosDb={fotosDb} interacoes={interacoes} onInteracao={onInteracao} />

      {/* A festa */}
      <section id="festa" className="scroll-mt-16 border-t border-border bg-card px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <Rotulo>A festa</Rotulo>
          <h2 className="mt-5 text-4xl font-black uppercase leading-tight sm:text-6xl">{cfg.festa.titulo}</h2>
          <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Data", v: <span className="first-letter:uppercase">{cfg.dataExtenso}</span> },
              { t: "Local", v: <>{cfg.local.nome}<br />{cfg.local.endereco}<br />{cfg.local.cidade}</> },
              { t: "Horário", v: <span className="first-letter:uppercase inline-block">{cfg.horario}</span> },
              { t: "Dresscode", v: <><strong className="font-black festa-marca">{cfg.dresscode.titulo}</strong><span className="mt-3 block text-sm font-light text-muted-foreground">{cfg.dresscode.nota}</span></> },
            ].map((c) => (
              <div key={c.t} className="bg-background p-7">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{c.t}</p>
                <p className="mt-3 text-lg font-bold leading-snug">{c.v}</p>
              </div>
            ))}
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
            {cfg.festa.atracoes.map((a) => <li key={a} className="bg-card px-6 py-5 text-base font-bold uppercase tracking-[0.08em]">{a}</li>)}
          </ul>

          <h3 className="mt-20 text-2xl font-black uppercase sm:text-3xl">COMO SERÁ A NOITE</h3>
          <ol className="mt-8 border-t border-border">
            {cfg.programacao.map((p) => (
              <li key={p.hora} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-4 border-b border-border py-5 sm:grid-cols-[10rem_1fr]">
                <span className="text-3xl font-black festa-marca sm:text-5xl">{p.hora}</span>
                <span className="text-lg">{p.item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Confirmação */}
      <section id="confirmar" className="scroll-mt-16 border-t border-border px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <Rotulo>Confirme sua presença</Rotulo>
            <h2 className="mt-5 text-4xl font-black uppercase leading-tight sm:text-6xl">{cfg.confirmacao.titulo}</h2>
            <p className="mt-5 text-lg text-muted-foreground">Confirmações {cfg.prazoTexto}.</p>
            <div className="relative mt-10 border border-border p-6">
              <Cantoneiras cor="festa-marca-border" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Pessoas confirmadas</p>
              <p className="mt-2 text-6xl font-black" aria-live="polite">{totalConfirmados ?? "—"}</p>
            </div>
            <div className="mt-8 border border-border">
              <p className="border-b border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Valores por pessoa</p>
              <dl className="divide-y divide-border">
                <div className="flex flex-wrap justify-between gap-4 px-6 py-4"><dt>Adulto</dt><dd className="font-bold">{brlCentavos(cfg.valores.pessoaCentavos)}</dd></div>
                <div className="flex justify-between gap-4 px-6 py-4"><dt>Criança</dt><dd className="font-bold">{cfg.valores.criancaTexto}</dd></div>
              </dl>
              <p className="border-t border-border px-6 py-4 text-sm text-muted-foreground">{cfg.valores.pagamento}</p>
            </div>
          </div>
          <div><FestaConfirmacaoForm onConfirmado={carregarTotal} /></div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <img src={fortemWordmark} alt="FORTEM" className="h-5 w-auto self-start invert" />
          <p className="text-xs font-bold uppercase tracking-[0.2em]">FORTEM · 10 ANOS · {cfg.dataCurta}</p>
          <p className="text-sm text-muted-foreground">{cfg.local.endereco} · {cfg.local.cidade}</p>
        </div>
      </footer>
    </main>
  );
}

function Negrito({ t }: { t: string }) {
  return <>{t.split(/(\*\*[^*]+\*\*)/).map((p, i) => p.startsWith("**") ? <strong key={i} className="font-bold">{p.slice(2, -2)}</strong> : p)}</>;
}

function Recolhivel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="mt-6 border-t border-border" onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-xs font-bold uppercase tracking-[0.2em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {titulo}<span aria-hidden className="text-xl festa-marca">{aberto ? "–" : "+"}</span>
      </summary>
      <div className="space-y-5 pb-4">{children}</div>
    </details>
  );
}

type HistoriaProps = { capitulos?: Capitulo[]; fotosDb: Record<string, FestaFoto[]> | null; interacoes: Record<string, FestaInteracao>; onInteracao: (id: string, i: FestaInteracao) => void; ajusteAutor?: AjusteFoto; audiosDb?: Record<string, Pick<FestaAudio, "url_audio" | "duracao_segundos">> };

export function NossaHistoria({ ajusteAutor = AJUSTE_PADRAO, capitulos = festaHistoriaCapitulos, fotosDb, interacoes, onInteracao, audiosDb = {} }: HistoriaProps) {
  const caps = capitulos.filter((c) => !c.oculto).map((c) => ({ ...c, audio: audiosDb[c.ano]?.url_audio || c.audio }));
  const comAudio = caps.filter((c) => c.audio);
  const duracao = textoDuracao(comAudio.map((c) => audiosDb[c.ano]?.duracao_segundos));
  const audioRef = useRef<HTMLAudioElement>(null);
  const isMobile = useIsMobile();
  const [tocando, setTocando] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracoes, setDuracoes] = useState<Record<string, number>>({});
  const [fila, setFila] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(caps[0]?.ano);
  const durDe = (ano?: string | null) => (ano ? audiosDb[ano]?.duracao_segundos || duracoes[ano] : undefined) || undefined;

  useEffect(() => {
    if (isMobile || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setAtivo(e.target.id.replace("cap-", ""))), { rootMargin: "-40% 0px -55% 0px" });
    caps.forEach((c) => { const el = document.getElementById(`cap-${c.ano}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [caps.length, isMobile]);

  const tocar = (ano: string | null, restante: string[] = []) => {
    const a = audioRef.current; if (!a) return;
    const c = caps.find((x) => x.ano === ano);
    if (!c?.audio) { a.pause(); setTocando(null); setFila([]); setPausado(false); return; }
    document.querySelectorAll("audio").forEach((o) => o !== a && o.pause());
    a.src = c.audio; setAtual(0); a.play().catch(() => setTocando(null)); setTocando(ano); setPausado(false); setFila(restante);
    if (isMobile && ano !== ativo) irPara(ano);
  };
  const fim = () => fila.length ? tocar(fila[0], fila.slice(1)) : setTocando(null);
  const tudo = fila.length > 0 || (tocando !== null && comAudio[0]?.ano === tocando && fila.length > 0);
  const btnAudio = "inline-flex min-h-11 items-center px-4 text-xs font-bold uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const [dir, setDir] = useState<1 | -1>(1);
  const toque = useRef<{ x: number; y: number } | null>(null);
  const idxAtivo = Math.max(0, caps.findIndex((c) => c.ano === ativo));
  const irPara = (ano: string) => {
    if (!isMobile) { document.getElementById(`cap-${ano}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const i = caps.findIndex((c) => c.ano === ano); if (i < 0 || ano === ativo) return;
    setDir(i > idxAtivo ? 1 : -1); setAtivo(ano);
    requestAnimationFrame(() => {
      const el = document.getElementById("capitulo-mobile"); if (!el) return;
      const topo = (document.querySelector("[data-festa] > header")?.getBoundingClientRect().height ?? 52)
        + (document.querySelector("[data-trilha]")?.getBoundingClientRect().height ?? 76) + 16;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topo, behavior: "smooth" });
    });
  };
  const passo = (d: 1 | -1) => { const c = caps[idxAtivo + d]; if (c) irPara(c.ano); };
  const alternarMini = () => {
    const a = audioRef.current; if (!a) return;
    if (tocando) { if (a.paused) a.play().catch(() => {}); else a.pause(); return; }
    const inicio = comAudio.findIndex((c) => caps.indexOf(c) >= idxAtivo);
    const lista = (inicio < 0 ? comAudio : comAudio.slice(inicio)).map((c) => c.ano);
    if (lista.length) tocar(lista[0], lista.slice(1));
  };
  const barraNarracao = (
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-8">
      <p className="text-sm"><strong className="font-bold uppercase tracking-[0.12em]">{ab.narracao.titulo}</strong> <span className="text-muted-foreground">{ab.narracao.autor} · {caps.length} capítulos{duracao ? ` · ${duracao}` : ""}</span></p>
      {comAudio.length > 0 && (
        <button type="button" aria-pressed={tocando !== null && tudo} onClick={() => (tocando ? tocar(null) : tocar(comAudio[0].ano, comAudio.slice(1).map((c) => c.ano)))} className={`${btnAudio} bg-primary text-primary-foreground`}>
          {tocando ? "Parar" : "Ouvir tudo"}
        </button>
      )}
    </div>
  );
  const anoMini = tocando ?? ativo;
  const idxMini = Math.max(0, caps.findIndex((c) => c.ano === anoMini));
  const durMini = durDe(tocando);
  const emReproducao = tocando !== null && !pausado;
  const miniPlayer = (
    <div className="relative h-[68px] border-t border-border bg-background">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-border" aria-hidden><div className="festa-marca-bg h-full" style={{ width: `${tocando && durMini ? Math.min(100, (atual / durMini) * 100) : 0}%` }} /></div>
      <div className="flex h-full items-center gap-3 px-5 pt-[3px]">
        <button type="button" onClick={alternarMini} aria-label={emReproducao ? "Pausar a história" : "Ouvir a história"} aria-pressed={emReproducao}
          className="festa-marca-bg flex h-11 w-11 shrink-0 items-center justify-center text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {emReproducao ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]">{ab.narracao.titulo}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">Capítulo {idxMini + 1} · {anoMini}</p>
        </div>
        {tocando && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{tempo(atual)} / {tempo(durMini)}</span>}
      </div>
    </div>
  );

  return (
    <section id="historia" className="scroll-mt-16 border-t border-border py-16 md:py-28">
      <audio ref={audioRef} preload="none" onEnded={fim} aria-label="Narração da história" className="hidden"
        onPlay={() => setPausado(false)} onPause={() => setPausado(true)}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (tocando && isFinite(d)) setDuracoes((m) => ({ ...m, [tocando]: d })); }} />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Rotulo>{ab.eyebrow}</Rotulo>
        <h2 className="mt-5 text-4xl font-black uppercase leading-tight md:text-6xl">{ab.titulo}</h2>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{ab.subtitulo}</p>
        <div className="mt-12 grid gap-10 md:grid-cols-[18rem_1fr]">
          <div className="relative self-start border border-border bg-card">
            {ab.autor.foto && <FotoAutor src={ab.autor.foto} alt={ab.autor.nome} ajuste={ajusteAutor} />}
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{ab.autor.rotulo}</p>
              <p className="mt-2 text-2xl font-black">{ab.autor.nome}</p>
              <p className="text-muted-foreground">{ab.autor.cargo}</p>
            </div>
          </div>
          <div className="max-w-[680px]">
            <p className="text-base leading-[1.6] md:text-2xl md:leading-[38px]">{ab.convite}</p>
            <p className="mt-6 text-lg font-bold md:text-xl">{ab.chamada}</p>
            <Recolhivel titulo={ab.apresentacaoTitulo}>
              {ab.apresentacao.map((p) => <p key={p} className="text-base leading-[1.6] md:text-[18px] md:leading-[30px]">{p}</p>)}
            </Recolhivel>
          </div>
        </div>
      </div>

      {isMobile ? (
        <TrilhaAnos anos={caps.map((c) => c.ano)} ativo={tocando ?? ativo} onIr={irPara} />
      ) : (
        <div className="sticky top-[68px] z-20 mt-14 border-y border-border bg-background">
          {barraNarracao}
          <nav aria-label="Anos da história" className="flex gap-1 overflow-x-auto px-5 pb-2 lg:hidden">
            {caps.map((c) => <a key={c.ano} href={`#cap-${c.ano}`} aria-current={(tocando ?? ativo) === c.ano} className={`inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${(tocando ?? ativo) === c.ano ? "festa-marca" : "text-muted-foreground"}`}>{c.ano}</a>)}
          </nav>
        </div>
      )}

      <div className={isMobile ? "festa-claro px-5 pb-16 pt-8" : "mx-auto mt-12 grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[12rem_1fr]"}>
        <nav aria-label="Capítulos" className="hidden lg:block">
          <ol className="sticky top-[150px] space-y-1">
            {caps.map((c) => (
              <li key={c.ano}><a href={`#cap-${c.ano}`} aria-current={ativo === c.ano} className={`block min-h-11 border-l-2 py-1 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo === c.ano ? "festa-marca-border" : "border-transparent"}`}>
                <span className={`block font-bold ${ativo === c.ano ? "festa-marca" : ""}`}>{c.ano}</span><span className="block text-xs text-muted-foreground">{c.titulo}</span>
              </a></li>
            ))}
          </ol>
        </nav>
        <div id={isMobile ? "capitulo-mobile" : undefined} className={`min-w-0 space-y-24 ${isMobile ? "overflow-x-clip" : ""}`}
          onTouchStart={isMobile ? (e) => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } : undefined}
          onTouchEnd={isMobile ? (e) => { const t = toque.current; toque.current = null; if (!t) return; const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y; if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) passo(dx < 0 ? 1 : -1); } : undefined}>
          {(isMobile ? caps.slice(idxAtivo, idxAtivo + 1) : caps).map((c) => {
            const fotos = fotosDb?.[c.ano] ?? (fotosDb ? undefined : cfg.historia.anos.find((a) => a.ano === c.ano)?.fotos);
            const [p1, ...resto] = c.paragrafos;
            const durCap = durDe(c.ano);
            return (
              <article key={c.ano} id={`cap-${c.ano}`} aria-labelledby={`tit-${c.ano}`} className={isMobile ? (dir > 0 ? "festa-slide-dir" : "festa-slide-esq") : "scroll-mt-40"}>
                {isMobile && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Capítulo {idxAtivo + 1}</p>}
                <p className={`text-[56px] font-black leading-none md:text-[72px] lg:text-[112px] ${isMobile ? "festa-marca" : ""}`}>{c.ano}</p>
                <div className={`mt-3 h-1 w-24 ${c.barraCinza ? "bg-border" : isMobile ? "bg-foreground" : "festa-marca-bg"}`} />
                <h3 id={`tit-${c.ano}`} className="mt-5 text-[20px] font-black uppercase leading-[1.25] md:text-3xl md:leading-normal">{c.titulo}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {isMobile ? (
                    c.audio && (emReproducao && tocando === c.ano ? (
                      <p role="status" className="inline-flex min-h-11 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] festa-vermelho-texto">
                        <span aria-hidden className="festa-eq inline-flex items-end gap-[2px]"><span /><span /><span /></span>
                        Tocando agora{durCap ? ` · ${tempo(durCap)}` : ""}
                      </p>
                    ) : (
                      <button type="button" onClick={() => tocar(c.ano)} className={`${btnAudio} border border-foreground`}>Ouvir capítulo{durCap ? ` · ${tempo(durCap)}` : ""}</button>
                    ))
                  ) : (
                    <>
                      {c.audio && <button type="button" aria-pressed={tocando === c.ano} onClick={() => tocar(tocando === c.ano ? null : c.ano)} className={`${btnAudio} border border-foreground`}>{tocando === c.ano ? "Parar" : "Ouvir capítulo"}</button>}
                      <span className="text-sm text-muted-foreground">{minutosLeitura(c.paragrafos)} min de leitura</span>
                    </>
                  )}
                </div>
                {c.numeros?.length ? (
                  <dl className="mt-8 grid gap-6 border-t-2 border-foreground pt-5 sm:grid-cols-3">
                    {c.numeros.map((n) => <div key={n.valor + n.legenda}><dt className={`text-[26px] font-black md:text-4xl ${isMobile ? "festa-vermelho-texto" : "festa-marca"}`}>{n.valor}</dt><dd className="text-[13px] text-muted-foreground md:text-sm">{n.legenda}</dd></div>)}
                  </dl>
                ) : null}
                <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,680px)_16rem]">
                  {c.frase && <aside className="self-start border-l-4 festa-marca-border pl-5 text-[20px] font-light leading-[1.4] md:text-[22px] md:leading-[32px] xl:sticky xl:top-40 xl:order-2">{c.frase}</aside>}
                  <div className="min-w-0 max-w-[680px] xl:order-1">
                    <p className="text-base leading-[1.6] md:text-[22px] md:leading-[34px]"><Negrito t={p1} /></p>
                    {resto.length > 0 && <Recolhivel titulo="Continuar lendo">{resto.map((p) => <p key={p} className="text-base leading-[1.6] md:text-[18px] md:leading-[30px]"><Negrito t={p} /></p>)}</Recolhivel>}
                    {c.pessoas?.length ? (
                      <div className="mt-8"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:text-xs">{c.pessoasRotulo}</p>
                        <ul className="mt-3 flex flex-wrap gap-2">{c.pessoas.map((p) => <li key={p} className="border border-border px-3 py-2 text-sm">{p}</li>)}</ul></div>
                    ) : null}
                  </div>
                </div>
                {!c.semFotos && (
                  <div className="mt-10 max-w-[560px]">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:text-xs">Fotos de {c.ano}</p>
                    {fotos?.length ? (
                      <div className="border border-border bg-card">
                        <div className="flex items-center gap-3 border-b border-border p-3">
                          <span aria-hidden className="flex h-9 w-9 items-center justify-center border-2 festa-marca-border font-black">F</span>
                          <div><p className="text-sm font-bold">FORTEM</p><p className="text-xs text-muted-foreground">{c.ano} · {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</p></div>
                        </div>
                        <div className="p-3"><FestaFotosAno ano={c.ano} fotos={fotos} interacoes={interacoes} onInteracao={onInteracao} /></div>
                      </div>
                    ) : (
                      <div className={`flex aspect-[4/3] w-full items-center justify-center border border-border ${isMobile ? "bg-muted" : "bg-card"}`}><span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Fotos em breve</span></div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {isMobile && (
            <div className="!mt-10 grid grid-cols-2 gap-3">
              <button type="button" aria-label="Capítulo anterior" disabled={idxAtivo === 0} onClick={() => passo(-1)}
                className="min-h-12 border border-muted-foreground text-[13px] font-bold uppercase tracking-[0.12em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">Anterior</button>
              {idxAtivo < caps.length - 1 ? (
                <button type="button" aria-label="Próximo capítulo" onClick={() => passo(1)}
                  className="min-h-12 bg-foreground text-[13px] font-bold uppercase tracking-[0.12em] text-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Próximo</button>
              ) : (
                <a href="#confirmar" className="inline-flex min-h-12 items-center justify-center bg-foreground text-[13px] font-bold uppercase tracking-[0.1em] text-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Confirmar presença</a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-5 sm:px-8 md:mt-24">
        <div className="relative festa-marca-bg p-8 sm:p-14">
          <Cantoneiras />
          <p className="text-3xl font-black uppercase leading-tight sm:text-5xl">{ab.fechamento.titulo}</p>
          <p className="mt-4 text-lg">{ab.fechamento.texto}</p>
          <a href="#confirmar" className="mt-8 inline-flex min-h-12 items-center bg-background px-7 text-sm font-bold uppercase tracking-[0.12em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ab.fechamento.botao}</a>
        </div>
      </div>
      {isMobile && comAudio.length > 0 && <div className="sticky bottom-0 z-20 mt-10 pb-[env(safe-area-inset-bottom)]">{miniPlayer}</div>}
    </section>
  );
}
