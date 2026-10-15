import { supabase } from "@/integrations/supabase/client";

export type FestaFoto = { id: string; ano: string; url: string; caminho: string | null; alt: string | null; ordem: number };

/** Agrupa por ano, ordenando por `ordem` (e depois por id para estabilidade). */
export function agruparFotosPorAno<T extends { ano: string; ordem: number; id: string }>(fotos: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const f of [...fotos].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) (out[f.ano] ??= []).push(f);
  return out;
}

/** Busca as fotos e resolve URL assinada (bucket privado) para as enviadas pela equipe. */
export async function carregarFestaFotos(): Promise<FestaFoto[]> {
  const { data, error } = await supabase.from("festa_fotos").select("id, ano, url, caminho, alt, ordem");
  if (error) throw error;
  const fotos = (data ?? []) as FestaFoto[];
  const caminhos = fotos.filter((f) => f.caminho).map((f) => f.caminho!);
  if (caminhos.length) {
    const { data: assinadas } = await supabase.storage.from("festa-fotos").createSignedUrls(caminhos, 60 * 60 * 24 * 7);
    const mapa = new Map((assinadas ?? []).map((s) => [s.path, s.signedUrl]));
    for (const f of fotos) if (f.caminho && mapa.get(f.caminho)) f.url = mapa.get(f.caminho)!;
  }
  return fotos;
}
