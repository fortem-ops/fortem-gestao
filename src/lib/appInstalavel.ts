export type AppInstalavel = "aluno" | "equipe";

export const APPS: Record<AppInstalavel, { manifest: string; titulo: string; icone: string }> = {
  aluno: { manifest: "/manifest-aluno.json", titulo: "FORTEM", icone: "/icon-aluno-192.png" },
  equipe: { manifest: "/manifest-equipe.json", titulo: "FORTEM Equipe", icone: "/icon-equipe-192.png" },
};

const ROTAS_EQUIPE = ["/login", "/recuperar-senha", "/redefinir-senha", "/equipe"];

/** App instalável pela rota. Demais telas da equipe são forçadas pelo AppLayout. */
export function appDaRota(pathname: string): AppInstalavel {
  return ROTAS_EQUIPE.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ? "equipe" : "aluno";
}

let forcado: AppInstalavel | null = null;
export function forcarApp(app: AppInstalavel | null): void {
  forcado = app;
}

function setAttr(seletor: string, criar: () => HTMLElement, attr: string, valor: string): void {
  let el = document.head.querySelector<HTMLElement>(seletor);
  if (!el) {
    el = criar();
    document.head.appendChild(el);
  }
  if (el.getAttribute(attr) !== valor) el.setAttribute(attr, valor);
}

export function aplicarApp(pathname: string): AppInstalavel {
  const app = forcado ?? appDaRota(pathname);
  const cfg = APPS[app];
  setAttr('link[rel="manifest"]', () => Object.assign(document.createElement("link"), { rel: "manifest" }), "href", cfg.manifest);
  setAttr('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement("link"), { rel: "apple-touch-icon" }), "href", cfg.icone);
  setAttr(
    'meta[name="apple-mobile-web-app-title"]',
    () => Object.assign(document.createElement("meta"), { name: "apple-mobile-web-app-title" }),
    "content",
    cfg.titulo,
  );
  return app;
}

export const MARCA_APP = "fortem_app";

export interface AmbienteApp {
  standalone: boolean;
  marca: string | null;
  /** iPhone/iPad: cada atalho tem armazenamento próprio, então a marca pode ficar no localStorage. */
  ios?: boolean;
}

export interface FontesAmbiente {
  navStandalone: boolean | undefined;
  displayStandalone: boolean;
  ios: boolean;
  marcaSessao: string | null;
  marcaLocal: string | null;
}

/**
 * Standalone = navigator.standalone (iOS antigo) OU display-mode standalone (iOS com manifest, Android).
 * Marca permanente (localStorage) só vale no iOS; no Android os dois atalhos dividem o localStorage do Chrome.
 */
export function ambienteDe(f: FontesAmbiente): AmbienteApp {
  const standalone = f.navStandalone === true || f.displayStandalone;
  const marca = f.marcaSessao ?? (f.ios && standalone ? f.marcaLocal : null);
  return { standalone, marca, ios: f.ios };
}

/** App da equipe instalado: aberto pelo atalho (standalone) com a marca da equipe. */
export function appEquipeStandalone(amb: AmbienteApp): boolean {
  return amb.standalone && amb.marca === "equipe";
}

/** No app da equipe, o portal e a raiz nunca abrem: vão para o login da equipe. */
export function redirecionarAppEquipe(pathname: string, amb: AmbienteApp): string | null {
  if (!appEquipeStandalone(amb)) return null;
  if (pathname === "/" || pathname === "/portal" || pathname.startsWith("/portal/")) return "/login";
  return null;
}

export function ehIos(nav: Navigator & { standalone?: boolean }): boolean {
  const ua = nav.userAgent ?? "";
  return "standalone" in nav || /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

function ler(storage: () => Storage): string | null {
  try {
    return storage().getItem(MARCA_APP);
  } catch {
    return null;
  }
}

export function lerFontesAmbiente(): FontesAmbiente {
  if (typeof window === "undefined") {
    return { navStandalone: undefined, displayStandalone: false, ios: false, marcaSessao: null, marcaLocal: null };
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    navStandalone: nav.standalone,
    displayStandalone: window.matchMedia?.("(display-mode: standalone)").matches === true,
    ios: ehIos(nav),
    marcaSessao: ler(() => window.sessionStorage),
    marcaLocal: ler(() => window.localStorage),
  };
}

export function lerAmbienteApp(): AmbienteApp {
  return ambienteDe(lerFontesAmbiente());
}

/** O que gravar quando a equipe é confirmada: nada fora do standalone; localStorage só no iOS. */
export function marcasParaGravar(amb: AmbienteApp): { sessao: boolean; local: boolean } {
  if (!amb.standalone) return { sessao: false, local: false };
  return { sessao: true, local: amb.ios === true };
}

/** Grava fortem_app=equipe após confirmar equipe em modo standalone. */
export function gravarMarcaEquipe(amb: AmbienteApp = lerAmbienteApp()): boolean {
  const m = marcasParaGravar(amb);
  if (!m.sessao || typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(MARCA_APP, "equipe");
    if (m.local) window.localStorage.setItem(MARCA_APP, "equipe");
  } catch {
    return false;
  }
  return true;
}

export type ResultadoChecagem = { ok: true; isStaff: boolean } | { ok: false };

/** Destino do login após checar o papel. Erro nunca leva ao portal (falha fechada). */
export function destinoAposChecagem(
  r: ResultadoChecagem,
  safeNext: string | null,
  appEquipe: boolean,
): string | "erro" | "area_equipe" {
  if (!r.ok) return "erro";
  if (r.isStaff) return safeNext ?? "/equipe";
  // Não é equipe: no app da equipe mostra a tela "Esta área é da equipe", nunca o portal.
  if (appEquipe) return "area_equipe";
  return safeNext ?? "/portal";
}
