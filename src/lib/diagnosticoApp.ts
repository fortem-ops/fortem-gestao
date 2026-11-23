/**
 * Histórico curto (30 eventos) do que acontece ao abrir o app, para o dono copiar
 * pela página /diagnostico-app. Só campos permitidos: nunca token, senha, id ou
 * parâmetros da URL; o único dado pessoal é o e-mail.
 */
export const CHAVE_DIAG = "fortem_diag_app";
export const LIMITE_DIAG = 30;

const CAMPOS_TEXTO = [
  "tipo", "pagina", "de", "para", "motivo", "origem", "email", "aal", "erro", "resultado", "display",
] as const;
const CAMPOS_BOOL = [
  "standalone_nav", "display_standalone", "ios", "tem_sessao", "sessao_confirmada", "app_equipe",
] as const;
const CAMPOS_NUM = ["token_min", "tentativa"] as const;
const CAMPOS_PAGINA = new Set(["pagina", "de", "para"]);

type CampoTexto = (typeof CAMPOS_TEXTO)[number];
type CampoBool = (typeof CAMPOS_BOOL)[number];
type CampoNum = (typeof CAMPOS_NUM)[number];

export type EventoDiag = { em: string } & Partial<Record<CampoTexto, string>> &
  Partial<Record<CampoBool, boolean>> &
  Partial<Record<CampoNum, number>> & { papeis?: string[]; marca_local?: string | null; marca_sessao?: string | null };

/** Só o caminho: corta ?query e #hash (podem carregar token). */
export function somenteCaminho(url: string): string {
  const semOrigem = url.replace(/^https?:\/\/[^/]+/i, "");
  return semOrigem.split(/[?#]/)[0] || "/";
}

export function limparEvento(bruto: Record<string, unknown>, agora: Date = new Date()): EventoDiag {
  const ev: EventoDiag = { em: agora.toISOString() };
  for (const c of CAMPOS_TEXTO) {
    const v = bruto[c];
    if (typeof v === "string") ev[c] = (CAMPOS_PAGINA.has(c) ? somenteCaminho(v) : v).slice(0, 160);
  }
  for (const c of CAMPOS_BOOL) if (typeof bruto[c] === "boolean") ev[c] = bruto[c] as boolean;
  for (const c of CAMPOS_NUM) if (typeof bruto[c] === "number" && Number.isFinite(bruto[c])) ev[c] = bruto[c] as number;
  if (Array.isArray(bruto.papeis)) ev.papeis = bruto.papeis.filter((p): p is string => typeof p === "string").slice(0, 10);
  for (const c of ["marca_local", "marca_sessao"] as const) {
    const v = bruto[c];
    if (v === null) ev[c] = null;
    else if (typeof v === "string") ev[c] = v.slice(0, 20);
  }
  return ev;
}

function storagePadrao(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function lerDiag(storage: Storage | null = storagePadrao()): EventoDiag[] {
  if (!storage) return [];
  try {
    const v: unknown = JSON.parse(storage.getItem(CHAVE_DIAG) ?? "[]");
    return Array.isArray(v) ? (v.filter((e) => e && typeof e === "object") as EventoDiag[]) : [];
  } catch {
    return [];
  }
}

export function registrarDiag(bruto: Record<string, unknown>, storage: Storage | null = storagePadrao()): void {
  if (!storage) return;
  try {
    const lista = [...lerDiag(storage), limparEvento(bruto)].slice(-LIMITE_DIAG);
    storage.setItem(CHAVE_DIAG, JSON.stringify(lista));
  } catch {
    /* armazenamento cheio ou bloqueado: diagnóstico é opcional */
  }
}

/** Texto para copiar e mandar. */
export function textoDiag(eventos: EventoDiag[], extra: Record<string, string> = {}): string {
  const cab = Object.entries(extra).map(([k, v]) => `${k}: ${v}`);
  const linhas = eventos.map((e) => {
    const { em, ...resto } = e;
    const partes = Object.entries(resto).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(",")}]` : String(v)}`);
    return `${em} ${partes.join(" ")}`;
  });
  return [...cab, `eventos: ${eventos.length}`, ...linhas].join("\n");
}
