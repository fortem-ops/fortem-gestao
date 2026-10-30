import { Link } from "react-router-dom";
import { SiteLayout } from "../SiteLayout";
import { PlaceholderFoto } from "../components/PlaceholderFoto";
import { ChamadaAcao } from "../components/Blocos";
import { linkWhatsApp, sitePath, type OrigemWhatsApp } from "../config";
import { PAGINAS_SERVICO, type Bloco, type Botao } from "../conteudoServicos";

function Botoes({ botoes, origem, escuro }: { botoes: Botao[]; origem: OrigemWhatsApp; escuro?: boolean }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      {botoes.map((b) => b.tipo === "whats"
        ? <a key={b.texto} href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer" className="sp-btn sp-btn-acao">{b.texto}</a>
        : <Link key={b.texto} to={b.href} className={`sp-btn ${escuro ? "sp-btn-contorno" : "sp-borda"}`}>{b.texto}</Link>)}
    </div>
  );
}

function Titulo({ rotulo, titulo, texto }: { rotulo?: string; titulo?: string; texto?: string }) {
  return (
    <div className="max-w-2xl">
      {rotulo && <p className="sp-rotulo sp-texto-acao">{rotulo}</p>}
      {titulo && <h2 className="mt-2 text-3xl leading-tight md:text-4xl">{titulo}</h2>}
      {texto && <p className="sp-texto2 mt-4">{texto}</p>}
    </div>
  );
}

function BlocoView({ b, origem, fundo }: { b: Bloco; origem: OrigemWhatsApp; fundo: string }) {
  const sec = `${fundo} py-16 md:py-20`;
  switch (b.tipo) {
    case "secao":
      return (
        <section className={sec}>
          <div className={`sp-container ${b.foto ? "grid items-center gap-10 md:grid-cols-2" : ""}`}>
            <div>
              <Titulo rotulo={b.rotulo} titulo={b.titulo} texto={b.texto} />
              {b.botoes && <Botoes botoes={b.botoes} origem={origem} />}
            </div>
            {b.foto && <PlaceholderFoto descricao={b.foto} />}
            {b.cards && (
              <div className={`mt-10 grid gap-4 sm:grid-cols-2 ${b.cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                {b.cards.map((c) => (
                  <div key={c.titulo} className="sp-borda bg-[hsl(var(--sp-branco))] p-6">
                    <p className="sp-rotulo sp-texto-acao">{c.titulo}</p>
                    <p className="sp-texto2 mt-3">{c.texto}</p>
                  </div>
                ))}
              </div>
            )}
            {b.numeros && (
              <div className="mt-10 grid gap-6 border-t border-[hsl(var(--sp-cinza))] pt-8 md:grid-cols-3">
                {b.numeros.map((n) => (
                  <div key={n.valor}><p className="text-3xl font-bold">{n.valor}</p><p className="sp-texto2 mt-1">{n.texto}</p></div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    case "etapas":
      return (
        <section className="sp-fundo-preto py-16 md:py-20">
          <div className="sp-container">
            <h2 className="text-3xl leading-tight md:text-4xl">{b.titulo}</h2>
            <ol className={`mt-10 grid gap-6 sm:grid-cols-2 ${b.itens.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {b.itens.map((e, i) => (
                <li key={e.titulo} className="border-t-2 border-[hsl(var(--sp-vermelho))] pt-4">
                  <p className="text-3xl font-bold text-[hsl(var(--sp-vermelho))]">{String(i + 1).padStart(2, "0")}</p>
                  <p className="sp-rotulo mt-2">{e.titulo}</p>
                  <p className="mt-2 text-[hsl(var(--sp-cinza))]">{e.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      );
    case "horarios":
      return (
        <section className={sec} aria-label={b.titulo}>
          <div className="sp-container grid gap-10 md:grid-cols-2">
            <div>
              <p className="sp-rotulo sp-texto-acao">Horários</p>
              <h2 className="mt-2 text-3xl">{b.titulo}</h2>
              <dl className="mt-6">
                {b.linhas.map((l) => (
                  <div key={l.dia} className="flex justify-between gap-4 border-b border-[hsl(var(--sp-cinza))] py-3">
                    <dt className="sp-rotulo">{l.dia}</dt><dd className="sp-texto2 text-right">{l.horario}</dd>
                  </div>
                ))}
              </dl>
              {b.local && <p className="sp-texto2 mt-4">{b.local}</p>}
            </div>
            {b.valores && (
              <div className="md:pt-12">
                {b.valores.map((v) => (
                  <div key={v.nome} className="flex items-baseline justify-between gap-4 border-b border-[hsl(var(--sp-cinza))] py-3">
                    <span className="sp-rotulo">{v.nome}</span><span className="text-2xl font-bold">{v.valor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    case "pessoas":
      return (
        <section className={sec}>
          <div className="sp-container">
            <p className="sp-rotulo sp-texto-acao">{b.rotulo}</p>
            <div className={`mt-8 grid gap-6 ${b.pessoas.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-[minmax(0,360px)_1fr] md:items-center md:gap-10"}`}>
              {b.pessoas.length > 1 ? b.pessoas.map((p) => (
                <div key={p.nome}>
                  <PlaceholderFoto descricao={p.foto ?? p.nome} className="aspect-[4/5]" />
                  <p className="mt-4 text-xl font-bold">{p.nome}</p>
                  {p.funcao && <p className="sp-rotulo sp-texto-acao mt-1">{p.funcao}</p>}
                  {p.registro && <p className="sp-texto2 mt-1 text-sm">{p.registro}</p>}
                </div>
              )) : (() => { const p = b.pessoas[0]; return (<>
                <PlaceholderFoto descricao={p.foto ?? p.nome} className="aspect-[4/5]" />
                <div>
                  <h2 className="text-3xl">{p.nome}</h2>
                  {p.funcao && <p className="sp-rotulo sp-texto-acao mt-2">{p.funcao}</p>}
                  {p.registro && <p className="sp-texto2 mt-1">{p.registro}</p>}
                  {p.itens && <ul className="mt-6 space-y-2">{p.itens.map((i) => <li key={i} className="border-l-2 border-[hsl(var(--sp-vermelho))] pl-3">{i}</li>)}</ul>}
                  {p.frase && <p className="sp-texto2 mt-6 max-w-xl">{p.frase}</p>}
                </div>
              </>); })()}
            </div>
            {b.nota && <p className="sp-texto2 mt-8">{b.nota}</p>}
          </div>
        </section>
      );
    case "faq":
      return (
        <section className={sec} aria-labelledby="sp-faq">
          <div className="sp-container max-w-3xl">
            <p className="sp-rotulo sp-texto-acao">Perguntas frequentes</p>
            <h2 id="sp-faq" className="mt-2 text-3xl">Dúvidas comuns</h2>
            <div className="mt-8 border-t border-[hsl(var(--sp-cinza))]">
              {b.itens.map((f) => (
                <details key={f.pergunta} className="group border-b border-[hsl(var(--sp-cinza))]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-bold [&::-webkit-details-marker]:hidden">
                    {f.pergunta}
                    <span className="sp-texto-acao text-2xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="sp-texto2 pb-5">{f.resposta}</p>
                  {f.link && <Link to={f.link.href} className="sp-rotulo sp-texto-acao mb-5 inline-block hover:underline">{f.link.texto}</Link>}
                </details>
              ))}
            </div>
          </div>
        </section>
      );
  }
}

export function SiteServicoPagina({ slug }: { slug: keyof typeof PAGINAS_SERVICO }) {
  const p = PAGINAS_SERVICO[slug];
  return (
    <SiteLayout titulo={p.meta.titulo} descricao={p.meta.descricao} path={sitePath(`/${slug}`)} origem={p.origem}>
      <section className="sp-fundo-preto">
        <div className="sp-container grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="sp-rotulo text-[hsl(var(--sp-vermelho))]">{p.hero.rotulo}</p>
            <h1 className="mt-4 text-4xl leading-[1.05] md:text-5xl">{p.hero.titulo}</h1>
            <p className="mt-5 max-w-lg text-[hsl(var(--sp-cinza))]">{p.hero.texto}</p>
            <Botoes botoes={p.hero.botoes} origem={p.origem} escuro />
          </div>
          <PlaceholderFoto descricao={p.hero.foto} className="aspect-[4/5] md:aspect-[4/3]" />
        </div>
      </section>
      {p.blocos.map((b, i) => {
        const claros = p.blocos.slice(0, i + 1).filter((x) => x.tipo !== "etapas").length;
        const fundo = (b.tipo === "secao" && b.claro) || claros % 2 === 1 ? "sp-fundo-superficie" : "";
        return <BlocoView key={i} b={b} origem={p.origem} fundo={fundo} />;
      })}
      <ChamadaAcao titulo={p.cta} origem={p.origem} />
    </SiteLayout>
  );
}
