import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { jsonLdNegocio } from "../seo";
import { Star } from "lucide-react";
import { SiteLayout, BotaoWhats } from "../SiteLayout";
import { PlaceholderFoto } from "../components/PlaceholderFoto";
import { CardEquipe } from "../components/CardEquipe";
import { EMAIL_CONTATO, ENDERECO_COMPLETO, MAPA_URL, PORTAL_EQUIPE_PATH, WHATSAPP_EXIBICAO, sitePath } from "../config";
import {
  DEPOIMENTOS, EQUIPE, ETAPAS, FOTOS_ESTRUTURA, HORARIOS, NOTA_GOOGLE, NUMEROS_ESTRUTURA, PLANOS_HOME, SERVICOS_HOME, VIDEO_ESTRUTURA_URL,
} from "../conteudo";

export function NotaGoogle({ claro }: { claro?: boolean }) {
  return (
    <a href={NOTA_GOOGLE.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-sm ${claro ? "text-[hsl(var(--sp-cinza))]" : "sp-texto2"}`}>
      <span className="flex text-[hsl(var(--sp-vermelho))]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
      </span>
      {NOTA_GOOGLE.nota} · {NOTA_GOOGLE.avaliacoes} avaliações no Google
    </a>
  );
}

function Cabecalho({ rotulo, titulo, texto, claro }: { rotulo: string; titulo: string; texto?: string; claro?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={`sp-rotulo ${claro ? "text-[hsl(var(--sp-vermelho))]" : "sp-texto-acao"}`}>{rotulo}</p>
      <h2 className="mt-2 text-3xl leading-tight md:text-4xl">{titulo}</h2>
      {texto && <p className={`mt-4 ${claro ? "text-[hsl(var(--sp-cinza))]" : "sp-texto2"}`}>{texto}</p>}
    </div>
  );
}

/** Mapa do Google: só carrega quando chega perto da tela; espaço reservado evita salto de layout. */
function MapaLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVer(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setVer(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="sp-foto mt-4 aspect-[4/3] w-full">
      {ver && (
        <iframe title="Mapa da FORTEM na Av. Independência, 358, Porto Alegre" src="https://www.google.com/maps?q=Av.+Independ%C3%AAncia,+358,+Porto+Alegre,+RS&output=embed"
          loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full border-0" />
      )}
    </div>
  );
}

const linkSeta = "sp-rotulo sp-texto-acao inline-block mt-4 hover:underline";

export function SiteHome() {
  const destaque = DEPOIMENTOS.find((d) => d.destaque);
  const curtos = DEPOIMENTOS.filter((d) => !d.destaque);
  return (
    <SiteLayout titulo="FORTEM · Treinamento funcional, nutrição e reabilitação em Porto Alegre" descricao="Treinamento funcional em Porto Alegre, com nutrição e reabilitação no mesmo lugar. Desde 2017 na Avenida Independência." path={sitePath()} origem="home" jsonLd={[jsonLdNegocio()]}>
      {/* 1 Hero */}
      <section className="sp-fundo-preto">
        <div className="sp-container grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="sp-rotulo text-[hsl(var(--sp-vermelho))]">Centro de treinamento, nutrição e reabilitação</p>
            <h1 className="mt-4 text-4xl uppercase leading-[1.05] md:text-6xl">Treino, nutrição e reabilitação no mesmo lugar.</h1>
            <p className="mt-5 max-w-lg text-[hsl(var(--sp-cinza))]">Treinamento funcional em Porto Alegre, com metodologia que respeita seus limites e faz você evoluir. Desde 2017 na Avenida Independência.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BotaoWhats origem="home" />
              <Link to="/planos" className="sp-btn sp-btn-contorno">Ver planos</Link>
            </div>
            <div className="mt-6"><NotaGoogle claro /></div>
          </div>
          <PlaceholderFoto descricao="treino em grupo no estúdio, preto e branco" className="aspect-[4/5] md:aspect-[4/3]" />
        </div>
      </section>

      {/* 2 Serviços */}
      <section className="sp-fundo-superficie py-16 md:py-24">
        <div className="sp-container">
          <Cabecalho rotulo="Serviços" titulo="Uma equipe multidisciplinar para o seu objetivo." texto="O treino, a consulta nutricional e a sessão de reabilitação trabalham juntos. Cada pessoa tem um foco e uma evolução próprios, e o plano parte disso." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICOS_HOME.map((s) => (
              <Link key={s.path} to={sitePath(s.path)} className="group flex flex-col sp-borda bg-[hsl(var(--sp-branco))] p-6 hover:border-[hsl(var(--sp-vermelho))]">
                <p className="sp-rotulo sp-texto-acao">{s.rotulo}</p>
                <h3 className="mt-3 text-xl">{s.titulo}</h3>
                <p className="mt-2 flex-1 sp-texto2">{s.texto}</p>
                <span className="sp-rotulo mt-6 group-hover:text-[hsl(var(--sp-acao))]">Saiba mais →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Estrutura */}
      <section id="estrutura" className="scroll-mt-20 py-16 md:py-24">
        <div className="sp-container">
          <Cabecalho rotulo="Estrutura" titulo="Um espaço pensado para treinar com segurança." texto="No coração da Avenida Independência desde 2017, com a estrutura de treinamento mais completa da região central de Porto Alegre." />
          {VIDEO_ESTRUTURA_URL && <a href={VIDEO_ESTRUTURA_URL} target="_blank" rel="noopener noreferrer" className={linkSeta}>Ver o vídeo da estrutura →</a>}
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {FOTOS_ESTRUTURA.map((f) => <PlaceholderFoto key={f} descricao={f} />)}
          </div>
          <dl className="mt-10 grid gap-6 border-t border-[hsl(var(--sp-cinza))] pt-8 sm:grid-cols-3">
            {NUMEROS_ESTRUTURA.map((n) => (
              <div key={n.valor}><dt className="text-3xl font-bold">{n.valor}</dt><dd className="mt-1 sp-texto2">{n.texto}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {/* 4 Equipe */}
      <section id="equipe" className="scroll-mt-20 sp-fundo-preto py-16 md:py-24">
        <div className="sp-container">
          <Cabecalho claro rotulo="Equipe" titulo="Quem acompanha o seu treino." texto="Profissionais formados e especializados em treinamento funcional, com nutrição e fisioterapia dentro do mesmo espaço." />
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
            {EQUIPE.map((p) => (
              <li key={p.nome}>
                <CardEquipe pessoa={p} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5 Depoimentos */}
      <section id="depoimentos" className="scroll-mt-20 sp-fundo-superficie py-16 md:py-24">
        <div className="sp-container">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Cabecalho rotulo="Depoimentos" titulo="Quem treina na FORTEM." />
            <a href={NOTA_GOOGLE.url} target="_blank" rel="noopener noreferrer" className="sp-btn sp-btn-acao self-start">Ver as {NOTA_GOOGLE.avaliacoes} avaliações no Google →</a>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="grid gap-4">
              {curtos.map((d) => (
                <blockquote key={d.nome} className="sp-borda bg-[hsl(var(--sp-branco))] p-6">
                  <p className="text-lg">“{d.texto}”</p>
                  <footer className="mt-4"><span className="sp-rotulo">{d.nome}</span> <span className="sp-texto2 text-sm">· {d.tempo}</span></footer>
                </blockquote>
              ))}
            </div>
            {destaque && (
              <blockquote className="sp-fundo-preto p-8">
                <p className="sp-rotulo text-[hsl(var(--sp-vermelho))]">Destaque</p>
                <p className="mt-4 leading-relaxed">“{destaque.texto}”</p>
                <footer className="mt-6"><span className="sp-rotulo">{destaque.nome}</span> <span className="text-sm text-[hsl(var(--sp-cinza))]">· {destaque.tempo}</span></footer>
              </blockquote>
            )}
          </div>
        </div>
      </section>

      {/* 6 Como começar */}
      <section className="py-16 md:py-24">
        <div className="sp-container">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Cabecalho rotulo="Primeiras etapas" titulo="Como você começa na FORTEM." />
            <BotaoWhats origem="home" className="self-start" />
          </div>
          <ol className="mt-10 grid gap-px bg-[hsl(var(--sp-cinza))] sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS.map((e) => (
              <li key={e.n} className="bg-[hsl(var(--sp-branco))] p-6">
                <p className="text-4xl font-bold text-[hsl(var(--sp-vermelho))]">{e.n}</p>
                <h3 className="sp-rotulo mt-4">{e.titulo}</h3>
                <p className="mt-2 sp-texto2">{e.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7 Planos */}
      <section className="sp-fundo-preto py-16 md:py-24">
        <div className="sp-container">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Cabecalho claro rotulo="Planos" titulo="Escolha pela frequência e pelo acompanhamento." texto="Monte o seu plano em poucos passos e veja os valores na página de planos." />
            <Link to="/planos" className="sp-btn sp-btn-acao self-start">Montar meu plano →</Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANOS_HOME.map((p) => (
              <Link key={p.nome} to="/planos" className="border border-[hsl(var(--sp-linha))] p-6 hover:border-[hsl(var(--sp-vermelho))]">
                <h3 className="text-3xl uppercase">{p.nome}</h3>
                <p className="sp-rotulo mt-2 text-[hsl(var(--sp-vermelho))]">{p.sub}</p>
                <p className="mt-4 text-[hsl(var(--sp-cinza))]">{p.texto}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 8 Corrida e Loja */}
      <section className="py-16 md:py-24">
        <div className="sp-container grid gap-4 md:grid-cols-2">
          {[
            { rotulo: "Corrida", titulo: "Grupo de Corrida FORTEM", texto: "Treino de corrida em grupo, com orientação profissional, do iniciante ao avançado.", cta: "Conhecer o grupo →", to: "/corrida" },
            { rotulo: "Loja", titulo: "Loja FORTEM", texto: "Produtos e serviços avulsos da FORTEM, com pagamento online.", cta: "Ir para a loja →", to: "/store" },
          ].map((b) => (
            <Link key={b.to} to={b.to} className="group sp-fundo-superficie p-8">
              <p className="sp-rotulo sp-texto-acao">{b.rotulo}</p>
              <h3 className="mt-3 text-2xl">{b.titulo}</h3>
              <p className="mt-2 sp-texto2">{b.texto}</p>
              <span className="sp-rotulo mt-6 inline-block group-hover:text-[hsl(var(--sp-acao))]">{b.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 9 Horários */}
      <section id="horarios" className="scroll-mt-20 sp-fundo-superficie py-16 md:py-24">
        <div className="sp-container grid gap-12 lg:grid-cols-2">
          <div>
            <Cabecalho rotulo="Horários" titulo="Quando atendemos." />
            <div className="mt-8 space-y-6">
              {HORARIOS.map((h) => (
                <div key={h.servico} className="border-t border-[hsl(var(--sp-cinza))] pt-4">
                  <h3 className="sp-rotulo">{h.servico}</h3>
                  <ul className="mt-2 space-y-1 sp-texto2">{h.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="sp-rotulo sp-texto-acao">Onde estamos</p>
            <MapaLazy />
            <a href={MAPA_URL} target="_blank" rel="noopener noreferrer" className="mt-4 block hover:underline">{ENDERECO_COMPLETO}</a>
            <p className="mt-2 sp-texto2">{WHATSAPP_EXIBICAO} · <a href={`mailto:${EMAIL_CONTATO}`} className="hover:underline">{EMAIL_CONTATO}</a></p>
            <BotaoWhats origem="home" className="mt-6" />
          </div>
        </div>
      </section>

      {/* 10 Portais */}
      <section className="py-16 md:py-24">
        <div className="sp-container grid gap-4 md:grid-cols-2">
          {[
            { titulo: "Portal do aluno", texto: "Sua agenda, seus treinos e o seu plano. Acesse com o seu cadastro de aluno.", to: "/portal" },
            { titulo: "Portal da equipe", texto: "Acesso para profissionais e administração. Gestão de alunos, agenda e financeiro.", to: PORTAL_EQUIPE_PATH },
          ].map((p) => (
            <Link key={p.titulo} to={p.to} className="group sp-borda p-8 hover:border-[hsl(var(--sp-vermelho))]">
              <h3 className="sp-rotulo">{p.titulo}</h3>
              <p className="mt-3 sp-texto2">{p.texto}</p>
              <span className="sp-rotulo sp-texto-acao mt-6 inline-block">Entrar →</span>
            </Link>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
