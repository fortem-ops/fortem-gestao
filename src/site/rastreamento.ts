/**
 * Rastreamento do site público (Google tag AW + Meta Pixel) com Consent Mode v2.
 * Só é usado nas rotas públicas (ver `ehRotaPublica`). Nada é gravado no banco.
 */

export const GOOGLE_ADS_ID = "AW-797888979";
export const META_PIXEL_ID = "1920832044845271";
/** Conversões do Google Ads — troque aqui se mudar o rótulo. */
export const CONVERSAO_WHATSAPP = "AW-797888979/MxrdCO_1764dENOju_wC";
export const CONVERSAO_COMPRA_PLANO = "AW-797888979/fUEDCNfL664dENOju_wC";

const CHAVE_CONSENTIMENTO = "fortem_cookies_v1";
const CHAVE_CAMPANHA = "fortem_campanha_v1";
const CHAVE_COMPRAS = "fortem_compras_enviadas_v1";
const DIA = 24 * 60 * 60 * 1000;
export const VALIDADE_CONSENTIMENTO_MS = 365 * DIA;
export const VALIDADE_CAMPANHA_MS = 90 * DIA;
export const EVENTO_ABRIR_PREFERENCIAS = "fortem:abrir-cookies";
export const EVENTO_CONSENTIMENTO = "fortem:consentimento";

/* ------------------------------ rotas ------------------------------ */

const ROTAS_EXATAS = new Set(["/", "/treinamento", "/nutricao", "/reabilitacao", "/avaliacao", "/experimental", "/planos", "/10anos", "/privacidade"]);
const PREFIXOS = ["/store", "/corrida", "/pagamento/"];

export function ehRotaPublica(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (ROTAS_EXATAS.has(p)) return true;
  return PREFIXOS.some((x) => (x.endsWith("/") ? p.startsWith(x) : p === x || p.startsWith(`${x}/`)));
}

/* --------------------------- consentimento -------------------------- */

export type Escolha = "aceito" | "recusado";

export function lerConsentimento(agora = Date.now()): Escolha | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CONSENTIMENTO);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as { escolha?: Escolha; em?: number };
    if ((v.escolha !== "aceito" && v.escolha !== "recusado") || typeof v.em !== "number") return null;
    if (agora - v.em > VALIDADE_CONSENTIMENTO_MS) return null;
    return v.escolha;
  } catch { return null; }
}

export function salvarConsentimento(escolha: Escolha, agora = Date.now()) {
  try { localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify({ escolha, em: agora, versao: 1 })); } catch { /* sem storage */ }
  aplicarConsentimento(escolha);
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMENTO, { detail: escolha }));
}

/* ------------------------------ tags ------------------------------- */

type Fn = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };
const w = () => window as unknown as { dataLayer?: unknown[]; gtag?: Fn; fbq?: Fn; _fbq?: Fn };

let gtagIniciado = false;
let pixelIniciado = false;

/** Carrega a Google tag com consentimento padrão NEGADO (antes de qualquer config). */
export function iniciarGtag() {
  if (gtagIniciado) return;
  gtagIniciado = true;
  const win = w();
  win.dataLayer = win.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  win.gtag = function gtag() { (win.dataLayer as unknown[]).push(arguments); } as Fn;
  win.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
  });
  if (lerConsentimento() === "aceito") win.gtag("consent", "update", concedido);
  win.gtag("js", new Date());
  win.gtag("config", GOOGLE_ADS_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(s);
}

const concedido = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" };
const negado = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };

/** Meta Pixel: só depois do aceite. */
export function iniciarPixel() {
  if (pixelIniciado) { chamarFbq("consent", "grant"); return; }
  pixelIniciado = true;
  const win = w();
  if (!win.fbq) {
    const n = function fbq(...args: unknown[]) {
      if (n.callMethod) n.callMethod.apply(n, args); else (n.queue as unknown[]).push(args);
    } as Fn;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    win.fbq = n;
    if (!win._fbq) win._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  chamarFbq("consent", "grant");
  chamarFbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
  chamarFbq("track", "PageView");
}

function chamarFbq(...args: unknown[]) {
  const f = w().fbq;
  if (!f) return;
  if (f.callMethod) f.callMethod.apply(f, args); else f(...args);
}

export function aplicarConsentimento(escolha: Escolha) {
  iniciarGtag();
  w().gtag?.("consent", "update", escolha === "aceito" ? concedido : negado);
  if (escolha === "aceito") iniciarPixel();
  else if (pixelIniciado) chamarFbq("consent", "revoke");
}

/** Mudança de página dentro do site (SPA). */
export function registrarPagina(caminho: string) {
  w().gtag?.("event", "page_view", { page_path: caminho, page_location: window.location.href });
  if (pixelIniciado && lerConsentimento() === "aceito") chamarFbq("track", "PageView");
}

/* ----------------------------- eventos ----------------------------- */

export function rastrearWhatsApp(origem: string) {
  try {
    w().gtag?.("event", "conversion", { send_to: CONVERSAO_WHATSAPP });
    w().gtag?.("event", "whatsapp_click", { origem });
    if (pixelIniciado && lerConsentimento() === "aceito") chamarFbq("track", "Contact", { origem });
  } catch { /* nunca quebra o clique */ }
}

/** Compra de plano (/planos): envia UMA vez por transaction_id, mesmo com recarga. */
export function rastrearCompraPlano(transactionId: string, valorCentavos: number): boolean {
  if (!transactionId || !(valorCentavos > 0)) return false;
  let enviados: string[] = [];
  try { enviados = JSON.parse(localStorage.getItem(CHAVE_COMPRAS) || "[]"); } catch { enviados = []; }
  if (enviados.includes(transactionId)) return false;
  if (typeof w().gtag !== "function") return false;
  const value = Math.round(valorCentavos) / 100;
  try {
    w().gtag!("event", "conversion", { send_to: CONVERSAO_COMPRA_PLANO, value, currency: "BRL", transaction_id: transactionId });
    if (pixelIniciado && lerConsentimento() === "aceito") chamarFbq("track", "Purchase", { value, currency: "BRL" }, { eventID: transactionId });
  } catch { /* silencia */ }
  try { localStorage.setItem(CHAVE_COMPRAS, JSON.stringify([...enviados, transactionId].slice(-50))); } catch { /* sem storage */ }
  return true;
}

/* -------------------------- gclid e UTMs --------------------------- */

const PARAMS_CAMPANHA = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type Campanha = Partial<Record<(typeof PARAMS_CAMPANHA)[number], string>>;

export function capturarCampanha(search: string, agora = Date.now()) {
  const q = new URLSearchParams(search);
  const novos: Campanha = {};
  for (const k of PARAMS_CAMPANHA) {
    const v = q.get(k)?.trim();
    if (v) novos[k] = v.slice(0, 200);
  }
  if (!Object.keys(novos).length) return;
  const atual = lerCampanha(agora) ?? {};
  try { localStorage.setItem(CHAVE_CAMPANHA, JSON.stringify({ valores: { ...atual, ...novos }, em: agora })); } catch { /* sem storage */ }
}

export function lerCampanha(agora = Date.now()): Campanha | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_CAMPANHA) || "null") as { valores?: Campanha; em?: number } | null;
    if (!v?.valores || typeof v.em !== "number" || agora - v.em > VALIDADE_CAMPANHA_MS) return null;
    return v.valores;
  } catch { return null; }
}

/** Sufixo discreto para a mensagem do WhatsApp (nunca o gclid em si). */
export function sufixoCampanha(c: Campanha | null): string {
  if (!c) return "";
  if (c.gclid || c.gbraid || c.wbraid) return " (ref: google-ads)";
  if (c.utm_source) {
    const s = c.utm_source.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 30);
    return s ? ` (ref: ${s})` : "";
  }
  return "";
}

export function ehLinkWhatsApp(href: string): boolean {
  return /^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i.test(href);
}

/** Acrescenta o sufixo ao texto de um link do WhatsApp (uma vez só). */
export function linkComSufixo(href: string, sufixo: string): string {
  if (!sufixo) return href;
  try {
    const u = new URL(href);
    const texto = u.searchParams.get("text") ?? "";
    if (texto.includes("(ref:")) return href;
    u.searchParams.set("text", `${texto}${sufixo}`);
    return u.toString();
  } catch { return href; }
}
