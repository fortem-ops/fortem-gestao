import { supabase } from "@/integrations/supabase/client";
import { SLUG_FESTA } from "@/lib/fotosPublico";

export type FotoPublica = { id: string; largura: number | null; altura: number | null; orientacao: string | null; url_previa: string | null; url_original: string | null };
export type EventoPublico = {
  evento: { slug: string; nome: string; data: string; texto_assinatura: string | null; local: string | null };
  capa: { url: string | null; largura: number | null; altura: number | null } | null;
  turnstile: { ativo: boolean; site_key: string | null };
};

/** Chama uma função pública; erro do servidor vira exceção com o código devolvido. */
export async function chamar<T>(funcao: "fotos-evento-publico" | "fotos-evento-envio", corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcao, { body: { slug: SLUG_FESTA, ...corpo } });
  if (error) {
    let codigo = "erro_interno";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { const j = await ctx.json().catch(() => null); if (j?.error) codigo = j.error; }
    throw new Error(codigo);
  }
  return data as T;
}
