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
}

/** App da equipe instalado: aberto pelo atalho (standalone) com a marca gravada por /equipe-app.html. */
export function appEquipeStandalone(amb: AmbienteApp): boolean {
  return amb.standalone && amb.marca === "equipe";
}

/** No app da equipe, o portal e a raiz nunca abrem: vão para o login da equipe. */
export function redirecionarAppEquipe(pathname: string, amb: AmbienteApp): string | null {
  if (!appEquipeStandalone(amb)) return null;
  if (pathname === "/" || pathname === "/portal" || pathname.startsWith("/portal/")) return "/login";
  return null;
}

export function lerAmbienteApp(): AmbienteApp {
  if (typeof window === "undefined") return { standalone: false, marca: null };
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
  let marca: string | null = null;
  try {
    marca = window.sessionStorage.getItem(MARCA_APP) ?? (nav.standalone === true ? window.localStorage.getItem(MARCA_APP) : null);
  } catch {
    marca = null;
  }
  return { standalone, marca };
}

export type ResultadoChecagem = { ok: true; isStaff: boolean } | { ok: false };

/** Destino do login após checar o papel. Erro nunca leva ao portal (falha fechada). */
export function destinoAposChecagem(r: ResultadoChecagem, safeNext: string | null, appEquipe: boolean): string | "erro" {
  if (!r.ok) return "erro";
  if (safeNext) return safeNext;
  if (r.isStaff) return "/equipe";
  return appEquipe ? "/login" : "/portal";
}
