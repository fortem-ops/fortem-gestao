const STORAGE_KEY = "fortem_oauth_portal_return";
const TTL_MS = 10 * 60 * 1000;

export function marcarRetornoOAuthPortal(agora = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(agora));
  } catch {
    // ignora storage bloqueado
  }
}

export function limparRetornoOAuthPortal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora storage bloqueado
  }
}

export function consumirRetornoOAuthPortal(agora = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    localStorage.removeItem(STORAGE_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) && agora - ts >= 0 && agora - ts <= TTL_MS;
  } catch {
    return false;
  }
}