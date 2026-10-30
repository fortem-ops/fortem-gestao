import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  EVENTO_ABRIR_PREFERENCIAS, aplicarConsentimento, capturarCampanha, ehLinkWhatsApp, ehRotaPublica, iniciarGtag,
  iniciarPixel, lerCampanha, lerConsentimento, linkComSufixo, rastrearWhatsApp, registrarPagina, salvarConsentimento, sufixoCampanha,
} from "./rastreamento";

/** Descobre de onde veio o clique (topo, hero, cta-final, flutuante, rodapé...). */
function origemDoClique(a: HTMLAnchorElement, pathname: string): string {
  const pagina = pathname === "/" ? "home" : pathname.split("/")[1] || "home";
  const marcada = a.closest<HTMLElement>("[data-wa-origem]")?.dataset.waOrigem;
  if (marcada) return marcada;
  let local = "conteudo";
  if (a.closest(".sp-flutuante")) local = "flutuante";
  else if (a.closest("header")) local = "topo";
  else if (a.closest("footer")) local = "rodape";
  else {
    const secao = a.closest("section");
    const main = a.closest("main");
    if (secao && main) {
      const secoes = Array.from(main.querySelectorAll(":scope > section, :scope > * > section"));
      const i = secoes.indexOf(secao);
      if (i === 0) local = "hero";
      else if (i === secoes.length - 1) local = "cta-final";
      else if (secao.id) local = secao.id;
    }
  }
  return `${pagina}-${local}`;
}

/** Tags (Google/Meta), banner LGPD e captura de campanha — só nas rotas públicas. */
export function RastreamentoPublico() {
  const { pathname, search } = useLocation();
  const publica = ehRotaPublica(pathname);
  const primeira = useRef(true);

  useEffect(() => {
    if (!publica) return;
    capturarCampanha(search);
    iniciarGtag();
    if (lerConsentimento() === "aceito") iniciarPixel();
    if (primeira.current) primeira.current = false;
    else registrarPagina(pathname + search);
  }, [publica, pathname, search]);

  useEffect(() => {
    if (!publica) return;
    const aoClicar = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !ehLinkWhatsApp(a.href)) return;
      const sufixo = sufixoCampanha(lerCampanha());
      if (sufixo) a.href = linkComSufixo(a.href, sufixo);
      rastrearWhatsApp(origemDoClique(a, window.location.pathname));
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [publica]);

  if (!publica) return null;
  return <BannerCookies />;
}

function BannerCookies() {
  const [aberto, setAberto] = useState(() => lerConsentimento() === null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
  }, []);

  // Reserva espaço para o botão flutuante do WhatsApp subir acima do banner.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!aberto || !ref.current) { raiz.style.removeProperty("--sp-banner-altura"); return; }
    const el = ref.current;
    const medir = () => raiz.style.setProperty("--sp-banner-altura", `${el.offsetHeight}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => { ro.disconnect(); raiz.style.removeProperty("--sp-banner-altura"); };
  }, [aberto]);

  if (!aberto) return null;
  const escolher = (e: "aceito" | "recusado") => { salvarConsentimento(e); setAberto(false); };
  // garante que uma escolha antiga já está aplicada quando o banner é reaberto
  const atual = lerConsentimento();
  if (atual) aplicarConsentimento(atual);

  return (
    <div ref={ref} className="sp-cookies" role="dialog" aria-live="polite" aria-label="Preferências de cookies">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&display=swap" />
      <div className="sp-cookies-conteudo">
        <p>
          Usamos cookies para medir o uso do site e melhorar a nossa comunicação. Você pode aceitar ou recusar. Saiba mais na{" "}
          <Link to="/privacidade">Política de privacidade</Link>.
        </p>
        <div className="sp-cookies-botoes">
          <button type="button" className="sp-cookies-btn sp-cookies-aceitar" onClick={() => escolher("aceito")}>Aceitar</button>
          <button type="button" className="sp-cookies-btn sp-cookies-recusar" onClick={() => escolher("recusado")}>Recusar</button>
        </div>
      </div>
    </div>
  );
}

export function abrirPreferenciasCookies() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_PREFERENCIAS));
}
