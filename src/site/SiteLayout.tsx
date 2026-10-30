import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { userHasStaffAccess } from "@/lib/authAccess";
import {
  EMAIL_CONTATO, ENDERECO_CURTO, PORTAL_EQUIPE_PATH, RAZAO_SOCIAL, REDES, WHATSAPP_EXIBICAO, WHATSAPP_NUMERO,
  linkWhatsApp, sitePath, type OrigemWhatsApp,
} from "./config";
import "./site.css";

const SERVICOS = [
  { label: "Treinamento", to: sitePath("/treinamento") },
  { label: "Nutrição", to: sitePath("/nutricao") },
  { label: "Reabilitação", to: sitePath("/reabilitacao") },
  { label: "Avaliação", to: sitePath("/avaliacao") },
];
const MENU = [
  { label: "Estrutura", to: sitePath("#estrutura") },
  { label: "Equipe", to: sitePath("#equipe") },
  { label: "Planos", to: "/planos" },
  { label: "Corrida", to: "/corrida" },
  { label: "Loja", to: "/store" },
  { label: "Horários e local", to: sitePath("#horarios") },
];

interface Props {
  titulo: string;
  descricao: string;
  path: string;
  origem: OrigemWhatsApp;
  /** Cabeçalho mínimo (campanhas): logo, telefone e WhatsApp. */
  minimo?: boolean;
  /** Página fora do Google (ex.: campanha /experimental). */
  noIndex?: boolean;
  children: ReactNode;
}

function ColunaRodape({ titulo, itens }: { titulo: string; itens: { label: string; to: string }[] }) {
  return (
    <div>
      <h3 className="sp-rotulo">{titulo}</h3>
      <ul className="mt-4 space-y-2 text-sm">{itens.map((m) => <li key={m.label}><Link to={m.to}>{m.label}</Link></li>)}</ul>
    </div>
  );
}

function Logo() {
  return <img src="/fortem-logo.png" alt="FORTEM" width={160} height={30} className="h-6 w-auto md:h-7" />;
}

export function BotaoWhats({ origem, className = "" }: { origem: OrigemWhatsApp; className?: string }) {
  return (
    <a href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer" className={`sp-btn sp-btn-acao ${className}`}>
      Falar no WhatsApp
    </a>
  );
}

/** Equipe logada: atalho discreto para o painel, sem redirecionar. Mesma consulta/cache do ProtectedRoute. */
function useSessaoEquipe() {
  const { user, isReady } = useAuth();
  const { data } = useQuery({
    queryKey: ["staff-access", user?.id],
    queryFn: () => (user ? userHasStaffAccess(user.id) : Promise.resolve(false)),
    enabled: isReady && !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return !!user && data === true;
}

export function SiteLayout({ titulo, descricao, path, origem, minimo, noIndex, children }: Props) {
  const equipe = useSessaoEquipe();
  const [aberto, setAberto] = useState(false);
  const [servicos, setServicos] = useState(false);
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);

  return (
    <div className="site-publico">
      <Seo title={titulo} description={descricao} path={path} noIndex={noIndex} />
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&display=swap" />
      </Helmet>

      {!minimo && (
        <div className="sp-topbar">
          <div className="sp-container flex h-9 items-center justify-between gap-4">
            <span className="truncate">{ENDERECO_CURTO}</span>
            <nav className="sp-rotulo flex shrink-0 gap-4 !text-[11px]" aria-label="Acesso">
              <Link to="/portal">Portal do aluno</Link>
              <Link to={PORTAL_EQUIPE_PATH}>Portal da equipe</Link>
              {equipe && <Link to={PORTAL_EQUIPE_PATH} className="sp-borda px-2">Ir para o painel</Link>}
            </nav>
          </div>
        </div>
      )}

      <header className="sp-header">
        <div className="sp-container flex h-16 items-center justify-between gap-4">
          <Link to={sitePath()} aria-label="FORTEM — início"><Logo /></Link>

          {minimo ? (
            <div className="flex items-center gap-4">
              <a href={`tel:+${WHATSAPP_NUMERO}`} className="hidden text-sm sm:inline">{WHATSAPP_EXIBICAO}</a>
              <BotaoWhats origem={origem} />
            </div>
          ) : (
            <>
              <nav className="sp-nav sp-rotulo hidden items-center gap-5 lg:flex" aria-label="Principal">
                <div className="relative" onMouseLeave={() => setServicos(false)}>
                  <button type="button" className="flex items-center gap-1 sp-rotulo" aria-expanded={servicos} aria-haspopup="true"
                    onClick={() => setServicos((v) => !v)} onMouseEnter={() => setServicos(true)}>
                    Serviços <ChevronDown className="h-3 w-3" aria-hidden />
                  </button>
                  {servicos && (
                    <div className="sp-submenu absolute left-0 top-full flex min-w-48 flex-col py-2">
                      {SERVICOS.map((s) => <Link key={s.to} to={s.to} className="px-4 py-2">{s.label}</Link>)}
                    </div>
                  )}
                </div>
                {MENU.map((m) => <Link key={m.label} to={m.to}>{m.label}</Link>)}
              </nav>
              <div className="hidden lg:block"><BotaoWhats origem={origem} /></div>
              <button type="button" className="lg:hidden p-2" aria-label={aberto ? "Fechar menu" : "Abrir menu"} aria-expanded={aberto}
                onClick={() => setAberto((v) => !v)}>
                {aberto ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </>
          )}
        </div>
        {!minimo && aberto && (
          <nav className="sp-mobile-menu sp-rotulo lg:hidden" aria-label="Menu">
            <div className="sp-container flex flex-col">
              {[...SERVICOS, ...MENU].map((m) => (
                <Link key={m.label} to={m.to} className="py-4" onClick={() => setAberto(false)}>{m.label}</Link>
              ))}
              <div className="py-4"><BotaoWhats origem={origem} className="w-full" /></div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {minimo ? (
        <footer className="sp-footer">
          <div className="sp-container flex flex-col gap-2 py-6 text-xs md:flex-row md:flex-wrap md:gap-x-4">
            <p>© 2026 FORTEM · Av. Independência, 358, Porto Alegre, RS</p>
            <Link to="/privacidade">Política de privacidade</Link>
            <Link to={sitePath()}>Site completo</Link>
          </div>
        </footer>
      ) : (
      <footer className="sp-footer">
        <div className="sp-container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm">Centro de treinamento, nutrição e reabilitação. Porto Alegre, desde 2017.</p>
          </div>
          {!minimo && (
            <>
              <ColunaRodape titulo="Serviços" itens={SERVICOS} />
              <ColunaRodape titulo="FORTEM" itens={MENU.filter((m) => ["Planos", "Corrida", "Loja", "Horários e local"].includes(m.label))} />
              <ColunaRodape titulo="Acesso" itens={[{ label: "Portal do aluno", to: "/portal" }, { label: "Portal da equipe", to: PORTAL_EQUIPE_PATH }]} />
            </>
          )}
          <div>
            <h3 className="sp-rotulo">Contato</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer">{WHATSAPP_EXIBICAO}</a></li>
              <li><a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a></li>
              {REDES.map((r) => <li key={r.nome}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.rotulo}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="border-t border-[hsl(var(--sp-linha))]">
          <div className="sp-container flex flex-col gap-2 py-4 text-xs md:flex-row md:justify-between">
            <p>© 2026 FORTEM. Todos os direitos reservados. · {RAZAO_SOCIAL}</p>
            <Link to="/privacidade">Política de privacidade</Link>
          </div>
        </div>
      </footer>
      )}

      <div className="sp-flutuante md:hidden">
        <a href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp"
          className="sp-btn sp-btn-acao h-14 w-14 !p-0">
          <MessageCircle className="h-6 w-6" aria-hidden />
        </a>
      </div>
    </div>
  );
}
