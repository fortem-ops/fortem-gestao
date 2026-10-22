import { supabase } from "@/integrations/supabase/client";

export type FestaFoto = { id: string; ano: string; url: string; caminho: string | null; alt: string | null; ordem: number };

/** Validade dos links fixos das fotos: 10 anos. */
export const LINK_FIXO_SEGUNDOS = 60 * 60 * 24 * 365 * 10;

/** Agrupa por ano, ordenando por `ordem` (e depois por id para estabilidade). */
export function agruparFotosPorAno<T extends { ano: string; ordem: number; id: string }>(fotos: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const f of [...fotos].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) (out[f.ano] ??= []).push(f);
  return out;
}

/** Uma foto enviada pela equipe já tem link fixo quando a url gravada é um endereço completo. */
export const temLinkFixo = (f: { url: string; caminho: string | null }) => !f.caminho || /^https?:\/\//.test(f.url);

/** Busca as fotos (equipe). Fotos ainda sem link fixo ganham um de 10 anos, gravado na própria foto. */
export async function carregarFestaFotos(): Promise<FestaFoto[]> {
  const { data, error } = await supabase.from("festa_fotos").select("id, ano, url, caminho, alt, ordem");
  if (error) throw error;
  const fotos = (data ?? []) as FestaFoto[];
  const sem = fotos.filter((f) => !temLinkFixo(f));
  if (sem.length) {
    const { data: assinadas } = await supabase.storage.from("festa-fotos").createSignedUrls(sem.map((f) => f.caminho!), LINK_FIXO_SEGUNDOS);
    const mapa = new Map((assinadas ?? []).map((s) => [s.path, s.signedUrl]));
    await Promise.all(sem.map(async (f) => {
      const link = mapa.get(f.caminho!);
      if (!link) return;
      f.url = link;
      await supabase.from("festa_fotos").update({ url: link }).eq("id", f.id);
    }));
  }
  return fotos;
}

/** Reduz a foto antes do envio (lado maior até 2000 px), sem cortar. Devolve o original se não compensar. */
export async function reduzirFoto(file: File, max = 2000, qualidade = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const tipo = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, qualidade));
    if (!blob || blob.size >= file.size) return file;
    const ext = tipo === "image/webp" ? "webp" : "jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: tipo });
  } catch { return file; }
}

/** Fotos para a página pública: lidas no servidor, sem acesso direto do visitante. */
export async function carregarFestaFotosPublico(): Promise<FestaFoto[]> {
  const { data, error } = await supabase.functions.invoke("festa-fotos-publico", { body: {} });
  if (error) throw error;
  return ((data as { fotos?: FestaFoto[] })?.fotos ?? []) as FestaFoto[];
}
