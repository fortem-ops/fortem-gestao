import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EventoFotos = Tables<"eventos_fotos">;
export type FotoEvento = Tables<"fotos_evento">;
export const BUCKET_FOTOS = "fotos-eventos";

/** Chama a função da equipe; erro do servidor vira exceção com o código devolvido. */
export async function fotosAdmin<T>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("fotos-evento-admin", { body: { acao, ...corpo } });
  if (error) {
    let codigo = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { const j = await ctx.json().catch(() => null); if (j?.error) codigo = j.error; }
    throw new Error(codigo);
  }
  return data as T;
}
