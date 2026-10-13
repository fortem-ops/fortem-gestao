import { supabase } from "@/integrations/supabase/client";

/** Sessão do checkout do site: só id da proposta e chave. Nunca CPF. */
export type SessaoCheckout = { proposta_id: string; chave_sessao: string };
const CHAVE = "fortem_checkout_2027";

export function lerSessao(): SessaoCheckout | null {
  try {
    const s = JSON.parse(window.sessionStorage.getItem(CHAVE) ?? "null");
    return s && typeof s.proposta_id === "string" && typeof s.chave_sessao === "string" ? { proposta_id: s.proposta_id, chave_sessao: s.chave_sessao } : null;
  } catch { return null; }
}
export function salvarSessao(s: SessaoCheckout) {
  try { window.sessionStorage.setItem(CHAVE, JSON.stringify({ proposta_id: s.proposta_id, chave_sessao: s.chave_sessao })); } catch { /* segue só em memória */ }
}
export function limparSessao() { try { window.sessionStorage.removeItem(CHAVE); } catch { /* nada */ } }

export class ErroCheckout extends Error { diagnostico?: string }

/** Chama a função pública planos-checkout; erros do servidor já vêm neutros. */
export async function checkout<T = any>(acao: string, corpo: Record<string, unknown>): Promise<T> {
  let headers: Record<string, string> | undefined;
  if (corpo.previa === true) {
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) headers = { Authorization: `Bearer ${s.session.access_token}` };
    } catch { /* segue sem sessão */ }
  }
  const { data, error } = await supabase.functions.invoke("planos-checkout", { body: { acao, ...corpo }, headers });
  if (error) {
    let msg = "Não foi possível continuar agora. Tente novamente em instantes";
    try { const j = await (error as any).context?.json?.(); if (typeof j?.error === "string") msg = j.error; } catch { /* genérica */ }
    throw new ErroCheckout(msg);
  }
  if (data && typeof (data as any).erro === "string") {
    const e = new ErroCheckout((data as any).erro);
    if (typeof (data as any).diagnostico === "string") e.diagnostico = (data as any).diagnostico;
    throw e;
  }
  return data as T;
}

export function mascararCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Parcelas em centavos com a sobra na última (mesma regra do servidor). */
export function dividirCentavos(total: number, n: number): number[] {
  const k = Math.max(1, Math.floor(n));
  const base = Math.floor(total / k);
  return Array.from({ length: k }, (_, i) => (i === k - 1 ? total - base * (k - 1) : base));
}

/** Frequência e período a partir do código do catálogo (ex.: power_2027_2x_anual). */
export function lerCodigo(codigo: string): { frequencia: string; periodo: "anual" | "mensal" | "" } {
  const m = /_(1x|2x|3x|livre)_(anual|mensal)$/.exec(codigo ?? "");
  return { frequencia: m?.[1] ?? "", periodo: (m?.[2] as "anual" | "mensal") ?? "" };
}

/** Rolou até o fim (tolerância de 8px). */
export function rolouAteOFim(el: { scrollTop: number; clientHeight: number; scrollHeight: number }): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
}

/**
 * Proposta pública: tenta abrir o checkout logo após o cadastro.
 * Devolve a sessão ou null quando o checkout não está liberado (a tela cai em "a equipe entra em contato").
 */
export async function iniciarCheckoutPublico(
  propostaId: string,
  chamar: (acao: string, corpo: Record<string, unknown>) => Promise<{ chave_sessao?: string; etapa?: string }> = checkout,
): Promise<{ sessao: SessaoCheckout; etapa: string } | null> {
  try {
    const r = await chamar("iniciar", { proposta_id: propostaId });
    if (!r?.chave_sessao) return null;
    return { sessao: { proposta_id: propostaId, chave_sessao: r.chave_sessao }, etapa: r.etapa ?? "identificada" };
  } catch { return null; }
}

/** Valida a sessão salva com "estado"; inválida ou expirada é apagada. */
export async function restaurarSessao(
  chamar: (acao: string, corpo: Record<string, unknown>) => Promise<{ etapa?: string }> = checkout,
): Promise<{ sessao: SessaoCheckout; etapa: string } | null> {
  const s = lerSessao();
  if (!s) return null;
  try {
    const r = await chamar("estado", s);
    return { sessao: s, etapa: r?.etapa ?? "identificada" };
  } catch { limparSessao(); return null; }
}
