// Regras puras da página pública Promoções 10 anos (/10anos/promocoes).
// Sem dependências exclusivas do Deno para rodar também no Vitest.

export const PROMO10_DATA_LIMITE_ISO = "2026-12-31";
export const PROMO10_REENVIO_SEGUNDOS = 60;
export const PROMO10_SESSAO_MINUTOS = 30;
export const PROMO10_MAX_TENTATIVAS = 5;

const PAPEIS_EQUIPE = new Set(["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"]);

/** Retorna a data YYYY-MM-DD no fuso America/Sao_Paulo. */
export function dataHojeBrasilia(agora: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Encerra após 31/12/2026 23:59 (Brasília). */
export function promo10Encerrada(agora: Date = new Date()): boolean {
  return dataHojeBrasilia(agora) > PROMO10_DATA_LIMITE_ISO;
}

/** Extrai somente o primeiro nome formatado para saudação. */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const limpo = (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  if (!limpo) return "Aluno";
  return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}

export function ehEquipePorPapel(roles: readonly string[] | null | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => PAPEIS_EQUIPE.has(r));
}

export function podeReenviar(enviadoEmIso: string, agoraMs: number = Date.now()): { ok: boolean; aguardarSegundos: number } {
  const enviadoMs = Date.parse(enviadoEmIso);
  if (Number.isNaN(enviadoMs)) return { ok: true, aguardarSegundos: 0 };
  const decorrido = Math.floor((agoraMs - enviadoMs) / 1000);
  if (decorrido >= PROMO10_REENVIO_SEGUNDOS) return { ok: true, aguardarSegundos: 0 };
  return { ok: false, aguardarSegundos: Math.max(1, PROMO10_REENVIO_SEGUNDOS - decorrido) };
}

export async function hashTokenSessao(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`promo10:${token}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function temAlgumaOferta(ofertas: {
  encerrada?: boolean;
  segmento?: string | null;
  principal?: unknown[];
  corrida?: unknown;
} | null | undefined): boolean {
  if (!ofertas || ofertas.encerrada) return false;
  if (ofertas.segmento === "equipe") return false;
  const temPrincipal = Array.isArray(ofertas.principal) && ofertas.principal.length > 0;
  const temCorrida = ofertas.corrida !== null && ofertas.corrida !== undefined;
  return temPrincipal || temCorrida;
}

export function corpoEmailPromo10(codigo: string): { assunto: string; html: string } {
  const assunto = `Seu código FORTEM 10 Anos: ${codigo}`;
  const html = `<!doctype html><html><body style="margin:0;background:#0e0e0e;font-family:Archivo,Arial,sans-serif;color:#f5f5f5">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<div style="font-weight:900;font-size:22px;letter-spacing:1px;text-transform:uppercase;border-bottom:4px solid #c8282a;padding-bottom:12px">FORTEM <span style="background:#c8282a;color:#ffffff;font-size:12px;padding:3px 8px;margin-left:6px;vertical-align:middle">10 ANOS</span></div>
<p style="font-size:16px;line-height:1.5;margin:24px 0;color:#e5e5e5">Use o código abaixo para confirmar que é você e ver suas condições especiais de aniversário.</p>
<div style="font-size:36px;font-weight:900;letter-spacing:8px;background:#1a1a1a;border:1px solid #4a4b4b;color:#ffffff;padding:16px 20px;display:inline-block">${codigo}</div>
<p style="font-size:15px;line-height:1.5;margin:24px 0 8px;color:#e5e5e5">Ele vale por 10 minutos.</p>
<p style="font-size:14px;line-height:1.5;color:#a3a3a3;margin:0 0 8px">Se você não pediu este código, ignore esta mensagem.</p>
<p style="font-size:14px;line-height:1.5;color:#a3a3a3;margin:0">Ninguém da FORTEM pede esse código por telefone ou WhatsApp.</p>
</div></body></html>`;
  return { assunto, html };
}