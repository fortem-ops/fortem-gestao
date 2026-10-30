import { jsonLdFaq } from "../seo";
import { Link } from "react-router-dom";
import { SiteLayout } from "../SiteLayout";
import { PlaceholderFoto } from "../components/PlaceholderFoto";
import { CardEquipe } from "../components/CardEquipe";
import { ChamadaAcao } from "../components/Blocos";
import { linkWhatsApp, sitePath } from "../config";
import { EQUIPE } from "../conteudo";
import { EXPERIMENTAL as E } from "../conteudoExperimental";
import { NotaGoogle } from "./SiteHome";
import { FOTOS_SITE, FOTOS_ESTRUTURA_SITE } from "../fotos";

const h2 = "text-3xl leading-tight md:text-4xl";

export function SiteExperimental() {
  return (
    <SiteLayout minimo titulo={E.meta.titulo} descricao={E.meta.descricao} path={sitePath("/experimental")} origem="experimental-topo" noIndex jsonLd={[jsonLdFaq(E.faq)]}>
      <section className="sp-fundo-preto">
        <div className="sp-container grid items-center gap-8 py-10 md:grid-cols-2 md:gap-10 md:py-20">
          <div className="min-w-0">
            <p className="sp-rotulo text-[hsl(var(--sp-vermelho))]">{E.hero.rotulo}</p>
            <h1 className="mt-4 break-words text-[2rem] uppercase leading-[1.05] sm:text-4xl md:text-5xl">{E.hero.titulo}</h1>
            <p className="mt-5 max-w-lg text-[hsl(var(--sp-cinza))]">{E.hero.texto}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={linkWhatsApp("experimental-hero")} target="_blank" rel="noopener noreferrer" aria-label={`${E.hero.botao} (abre em nova aba)`} className="sp-btn sp-btn-acao">{E.hero.botao}</a>
              <Link to="/planos" className="sp-btn sp-btn-contorno">Ver planos</Link>
            </div>
            <div className="mt-6"><NotaGoogle claro /></div>
            <p className="mt-2 text-sm text-[hsl(var(--sp-cinza))]">{E.hero.endereco}</p>
          </div>
          <PlaceholderFoto {...FOTOS_SITE["experimental-hero"]} prioridade />
        </div>
      </section>

      <section className="sp-fundo-superficie py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.porque.titulo}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {E.porque.itens.map((i) => (
              <div key={i.titulo} className="sp-borda bg-[hsl(var(--sp-branco))] p-6">
                <p className="sp-rotulo sp-texto-acao">{i.titulo}</p>
                <p className="mt-3 sp-texto2">{i.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.etapas.titulo}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {E.etapas.itens.map((e, n) => (
              <li key={e.titulo} className="border-t-2 border-[hsl(var(--sp-vermelho))] pt-4">
                <p className="text-3xl font-bold sp-texto-acao">{String(n + 1).padStart(2, "0")}</p>
                <p className="sp-rotulo mt-2">{e.titulo}</p>
                <p className="mt-2 sp-texto2">{e.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sp-fundo-superficie py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.espaco.titulo}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {E.espaco.fotos.map((f, i) => <PlaceholderFoto key={f} {...FOTOS_ESTRUTURA_SITE[i]} />)}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.profissionais.titulo}</h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {EQUIPE.map((p) => (
              <li key={p.nome}>
                <CardEquipe pessoa={p} compacto />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sp-fundo-superficie py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.horarios.titulo}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {E.horarios.servicos.map((s) => (
              <div key={s.servico}>
                <p className="sp-rotulo sp-texto-acao">{s.servico}</p>
                <ul className="mt-3 space-y-1">{s.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mt-8 font-bold">{E.horarios.endereco}</p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="sp-container">
          <h2 className={h2}>{E.depoimentos.titulo}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {E.depoimentos.itens.map((d) => (
              <blockquote key={d.nome} className="sp-borda p-6">
                <p>"{d.texto}"</p>
                <footer className="mt-4 text-sm sp-texto2">— {d.nome} · {d.tempo}</footer>
              </blockquote>
            ))}
          </div>
          <a href={E.depoimentos.url} target="_blank" rel="noopener noreferrer" className="sp-rotulo sp-texto-acao mt-6 inline-block hover:underline">{E.depoimentos.link}</a>
        </div>
      </section>

      <section className="sp-fundo-preto py-14 md:py-20">
        <div className="sp-container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className={h2}>{E.planos.titulo}</h2>
            <p className="mt-3 text-[hsl(var(--sp-cinza))]">{E.planos.texto}</p>
          </div>
          <Link to="/planos" className="sp-btn sp-btn-contorno">{E.planos.botao}</Link>
        </div>
      </section>

      <section className="py-14 md:py-20" aria-labelledby="sp-faq">
        <div className="sp-container max-w-3xl">
          <h2 id="sp-faq" className={h2}>Perguntas frequentes</h2>
          <div className="mt-8 border-t border-[hsl(var(--sp-cinza))]">
            {E.faq.map((f) => (
              <details key={f.pergunta} className="group border-b border-[hsl(var(--sp-cinza))]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-bold [&::-webkit-details-marker]:hidden">
                  {f.pergunta}
                  <span className="sp-texto-acao text-2xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="sp-texto2 pb-5">{f.resposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ChamadaAcao titulo={E.cta} origem="experimental-cta-final" />
    </SiteLayout>
  );
}
