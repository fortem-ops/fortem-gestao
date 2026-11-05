// Código de indicação vindo de /experimental?ind=CODIGO.
// Fica só no navegador (90 dias) e entra na mensagem pronta do WhatsApp; nada é gravado no servidor.
const CHAVE = "fortem_indicacao";
const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;
const FORMATO = /^[A-HJ-NP-Z2-9]{8}$/;

export function normalizarCodigoIndicacao(v: string | null | undefined): string | null {
  const c = (v || "").trim().toUpperCase();
  return FORMATO.test(c) ? c : null;
}

/** Lê ?ind= da URL e guarda, se for um código no formato válido. */
export function capturarCodigoIndicacao(search: string = typeof window !== "undefined" ? window.location.search : "") {
  try {
    const codigo = normalizarCodigoIndicacao(new URLSearchParams(search).get("ind"));
    if (codigo) localStorage.setItem(CHAVE, JSON.stringify({ codigo, salvo_em: Date.now() }));
  } catch { /* navegador sem localStorage */ }
}

export function lerCodigoIndicacao(agora = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const { codigo, salvo_em } = JSON.parse(raw);
    if (!salvo_em || agora - salvo_em > VALIDADE_MS) { localStorage.removeItem(CHAVE); return null; }
    return normalizarCodigoIndicacao(codigo);
  } catch { return null; }
}
