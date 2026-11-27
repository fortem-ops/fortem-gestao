export const PUSH_ADIADO_KEY = "fortem.portal.push.adiado-ate";
export const PUSH_SESSAO_KEY = "fortem.portal.push.contexto";
export const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export function pushAdiado(agora = Date.now()) {
  try { return Number(localStorage.getItem(PUSH_ADIADO_KEY)) > agora; } catch { return false; }
}

