import { supabase } from "@/integrations/supabase/client";

export type FestaComentario = { id: string; nome: string; texto: string; created_at: string };
export type FestaInteracao = { curtidas: number; curti: boolean; comentarios: FestaComentario[] };

/** Validação local (o servidor valida de novo). Retorna mensagem de erro ou null. */
export function validarComentario(nome: string, texto: string): string | null {
  const n = nome.trim(), t = texto.trim();
  if (n.length < 2 || n.length > 60) return "Informe seu nome.";
  if (t.length < 2) return "Escreva um comentário.";
  if (t.length > 300) return "Máximo de 300 caracteres.";
  if (/https?:\/\/|www\./i.test(t + " " + n)) return "Links não são permitidos.";
  return null;
}

export function visitanteId() {
  const k = "festa_visitante_id";
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
  return v;
}

export async function carregarInteracoes(): Promise<Record<string, FestaInteracao>> {
  const { data, error } = await supabase.rpc("fn_festa_fotos_interacoes" as any, { _visitante: visitanteId() });
  if (error) throw error;
  return (data ?? {}) as Record<string, FestaInteracao>;
}

export async function interagir(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("festa-fotos-interagir", { body });
  if (error) {
    let code = "";
    try { code = (await (error as any).context?.json())?.error ?? ""; } catch { /* */ }
    throw new Error(code === "limite" ? "Muitas tentativas. Tente mais tarde." : code === "link" ? "Links não são permitidos." : code === "repetido" ? "Comentário repetido." : "Não foi possível enviar.");
  }
  return data;
}
