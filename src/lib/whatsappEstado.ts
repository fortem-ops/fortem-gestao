// Estado leve compartilhado: qual conversa está aberta e preferência de som.
let conversaAberta: string | null = null;
export const setConversaAberta = (id: string | null) => { conversaAberta = id; };
export const getConversaAberta = () => conversaAberta;

const CHAVE_SOM = "whatsapp-som";
export const somLigado = () => typeof localStorage !== "undefined" && localStorage.getItem(CHAVE_SOM) === "1";
export const setSomLigado = (v: boolean) => localStorage.setItem(CHAVE_SOM, v ? "1" : "0");

export function tocarBeep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
    o.onended = () => ctx.close();
  } catch { /* sem áudio */ }
}
