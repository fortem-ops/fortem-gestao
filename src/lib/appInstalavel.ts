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
