import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { festa10AnosConfig as cfg } from "@/config/festa10anos";
import { brlCentavos } from "@/lib/festa10anos";
import { Seo } from "@/components/Seo";
import FestaConfirmacaoForm from "@/components/festa/FestaConfirmacaoForm";
import FestaFotosAno from "@/components/festa/FestaFotosAno";
import { agruparFotosPorAno, carregarFestaFotosPublico, type FestaFoto } from "@/lib/festaFotos";
import { carregarInteracoes, type FestaInteracao } from "@/lib/festaInteracoes";
import fortemWordmark from "@/assets/fortem-wordmark.png";

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
const btnPrim = "inline-flex min-h-12 items-center justify-center bg-primary px-7 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const btnSec = "inline-flex min-h-12 items-center justify-center border-2 border-foreground px-7 text-sm font-bold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Festa10Anos() {
  const [totalConfirmados, setTotalConfirmados] = useState<number | null>(null);

  const carregarTotal = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_festa_total_confirmados" as any);
    if (!error && typeof data === "number") setTotalConfirmados(data);
  }, []);
  useEffect(() => { carregarTotal(); }, [carregarTotal]);
  const [fotosDb, setFotosDb] = useState<Record<string, FestaFoto[]> | null>(null);
  useEffect(() => { carregarFestaFotosPublico().then((f) => setFotosDb(agruparFotosPorAno(f))).catch(() => setFotosDb(null)); }, []);

  const [interacoes, setInteracoes] = useState<Record<string, FestaInteracao>>({});
  useEffect(() => { carregarInteracoes().then(setInteracoes).catch(() => {}); }, []);
  const onInteracao = useCallback((id: string, i: FestaInteracao) => setInteracoes((m) => ({ ...m, [id]: i })), []);

  const local = `${cfg.local.endereco} · ${cfg.horario} · confirmações ${cfg.prazoTexto}`;

  return (
    <main data-festa="10anos" className="min-h-screen overflow-x-hidden bg-background font-light text-foreground">
      <Seo title="FORTEM · 10 anos | 14.11.26" description="Dez anos de movimento. Confirme sua presença na festa de 10 anos da FORTEM, em 14 de novembro de 2026." path="/10anos" />

      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href="#topo" aria-label="FORTEM, início" className="inline-flex min-h-11 items-center"><img src={fortemWordmark} alt="FORTEM" className="h-5 w-auto invert sm:h-6" /></a>
          <nav aria-label="Seções" className="flex items-center gap-1 sm:gap-4">
            <a href="#historia" className={`${linkCls} hidden sm:inline-flex`}>História</a>
            <a href="#festa" className={`${linkCls} hidden sm:inline-flex`}>A festa</a>
            <a href="#confirmar" className="inline-flex min-h-11 items-center bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Confirmar presença</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="topo" className="px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-10 sm:gap-x-8 lg:grid-cols-[1.3fr_1fr] lg:gap-x-14 lg:gap-y-8">
          <div className="col-start-1 row-start-1">
            <Rotulo>{cfg.hero.selo}</Rotulo>
            <h1 className="mt-5 text-[2.9rem] font-black leading-[0.85] sm:text-8xl lg:text-[9rem]">{cfg.dataCurta}</h1>
          </div>
          <div className="relative mx-auto aspect-square w-[5rem] self-center sm:w-[9rem] lg:row-span-2 lg:w-full lg:max-w-[26rem]">
            <Cantoneiras />
            <div className="festa-marca-bg flex h-full w-full items-center justify-center">
              <span className="text-[2.4rem] font-black leading-none text-foreground sm:text-[6rem] lg:text-[13rem]">10</span>
            </div>
          </div>
          <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <p className="text-2xl font-extrabold uppercase tracking-[0.06em] sm:text-3xl">{cfg.hero.titulo}</p>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{cfg.hero.texto}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#confirmar" className={btnPrim}>Confirmar presença</a>
              <a href="#historia" className={btnSec}>Nossa história</a>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">{local}</p>
          </div>
        </div>
      </section>


      {/* História */}
      <section id="historia" className="scroll-mt-16 border-t border-border px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <Rotulo>Nossa história</Rotulo>
          <h2 className="mt-5 text-4xl font-black uppercase leading-tight sm:text-6xl">{cfg.historia.titulo}</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{cfg.historia.texto}</p>
          <ol className="mt-14 max-w-5xl border-t border-border">
            {cfg.historia.anos.map((a) => (
              <li key={a.ano} className="grid gap-5 border-b border-border py-8 md:grid-cols-[15rem_1fr_22rem] md:items-center md:gap-10">
                <p className={`whitespace-nowrap font-black festa-marca ${a.ano.length > 5 ? "text-3xl sm:text-4xl" : "text-5xl sm:text-6xl"}`}>{a.ano}</p>
                <ul className="space-y-3 md:pt-2">
                  {a.marcos.map((m) => <li key={m} className="border-l-2 border-border pl-4 leading-relaxed">{m}</li>)}
                </ul>
                {(fotosDb?.[a.ano] ?? (fotosDb ? undefined : a.fotos))?.length ? (
                  <FestaFotosAno ano={a.ano} fotos={(fotosDb?.[a.ano] ?? a.fotos)!} proporcao={a.fotoProporcao} interacoes={interacoes} onInteracao={onInteracao} />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center border border-border bg-card">
                    <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Foto em breve</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

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
                <div className="flex justify-between gap-4 px-6 py-4"><dt>Aluno, ex-aluno e amigo(a) da FORTEM</dt><dd className="font-bold">{brlCentavos(cfg.valores.convidadoCentavos)}</dd></div>
                <div className="flex justify-between gap-4 px-6 py-4"><dt>Acompanhante</dt><dd className="font-bold">{brlCentavos(cfg.valores.acompanhanteCentavos)}</dd></div>
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
