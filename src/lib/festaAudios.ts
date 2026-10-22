import { supabase } from "@/integrations/supabase/client";
import { LINK_FIXO_SEGUNDOS } from "@/lib/festaFotos";

export type FestaAudio = { ano: string; url_audio: string; caminho: string | null; duracao_segundos: number | null; atualizado_em: string };

export const AUDIO_TIPOS = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave"];
export const AUDIO_EXT = /\.(mp3|m4a|wav)$/i;
export const AUDIO_MAX = 25 * 1024 * 1024;
export const ANOS_HISTORIA = Array.from({ length: 12 }, (_, i) => String(2016 + i));

export function audioValido(f: { name: string; type: string; size: number }): string | null {
  if (!AUDIO_EXT.test(f.name) && !AUDIO_TIPOS.includes(f.type)) return "Envie um arquivo mp3, m4a ou wav.";
  if (f.size > AUDIO_MAX) return "O áudio pode ter no máximo 25 MB.";
  return null;
}

/** "cerca de N min" a partir da soma das durações; null se não houver duração. */
export function textoDuracao(segundos: (number | null | undefined)[]): string | null {
  const total = segundos.reduce<number>((s, x) => s + (x && x > 0 ? x : 0), 0);
  if (total <= 0) return null;
  return `cerca de ${Math.max(1, Math.round(total / 60))} min`;
}

export async function carregarFestaAudios(): Promise<Record<string, FestaAudio>> {
  const { data, error } = await supabase.from("festa_audios" as any).select("ano, url_audio, caminho, duracao_segundos, atualizado_em");
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as unknown as FestaAudio[]).map((a) => [a.ano, a]));
}

function duracaoArquivo(file: File): Promise<number | null> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const fim = (v: number | null) => { URL.revokeObjectURL(url); res(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => fim(isFinite(a.duration) ? Math.round(a.duration) : null);
    a.onerror = () => fim(null);
    a.src = url;
  });
}

export async function enviarFestaAudio(ano: string, file: File, anterior?: FestaAudio | null) {
  const erro = audioValido(file); if (erro) throw new Error(erro);
  const ext = (file.name.match(AUDIO_EXT)?.[1] ?? "mp3").toLowerCase();
  const caminho = `${ano}/${Date.now()}.${ext}`;
  const { error: up } = await supabase.storage.from("festa-audios").upload(caminho, file, { contentType: file.type || undefined });
  if (up) throw up;
  const { data: s, error: se } = await supabase.storage.from("festa-audios").createSignedUrl(caminho, LINK_FIXO_SEGUNDOS);
  if (se || !s) throw se ?? new Error("Não foi possível gerar o link do áudio.");
  const duracao = await duracaoArquivo(file);
  const { error } = await supabase.from("festa_audios" as any).upsert({ ano, url_audio: s.signedUrl, caminho, duracao_segundos: duracao, atualizado_em: new Date().toISOString() });
  if (error) { await supabase.storage.from("festa-audios").remove([caminho]); throw error; }
  if (anterior?.caminho) await supabase.storage.from("festa-audios").remove([anterior.caminho]);
}

export async function removerFestaAudio(a: FestaAudio) {
  const { error } = await supabase.from("festa_audios" as any).delete().eq("ano", a.ano);
  if (error) throw error;
  if (a.caminho) await supabase.storage.from("festa-audios").remove([a.caminho]);
}
