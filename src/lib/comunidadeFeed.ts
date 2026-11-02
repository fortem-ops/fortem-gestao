import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { reduzirCapa } from "@/lib/comunidade";

// Feed da Comunidade: só eventos reconhecidos pelo servidor (fn_comunidade_compartilhar), sem texto livre.
export const BUCKET_FEED = "comunidade-feed";
export const FEED_FOTO_MAX_BYTES = 3 * 1024 * 1024;
export const FEED_FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const VERSAO_TERMO_FEED = "v1";
export const TERMO_FEED =
  "Ao participar, seu nome abreviado, seu plano e os eventos que você escolher compartilhar ficam visíveis para outros alunos participantes. Você decide cada compartilhamento, pode apagar e pode sair a qualquer momento, o que remove suas publicações.";
export const AVISO_FOTO_FEED =
  "Fotos passam por análise da equipe antes de aparecer. Use fotos sem outras pessoas identificáveis.";

export type FeedFiltro = "fortem" | "clubes";
export type FeedStatus = { participa: boolean; suspenso: boolean; versao_termo: string | null };
export type FeedPost = {
  id: string; eh_meu: boolean; nome: string; plano_chave: string | null;
  tipo: "treino" | "conquista" | "sequencia" | "recorde"; payload: Record<string, any>;
  audiencia: FeedFiltro; foto_path: string | null; created_at: string; reacoes: number; eu_reagi: boolean;
};
export type Compartilhaveis = {
  treino: { id: string; modalidade: string; horario: string } | null;
  conquistas: { id: string; nome: string; codigo: string; tipo: "conquista" | "sequencia" }[];
};

const ERROS: Record<string, string> = {
  sem_consentimento: "Você precisa participar do feed para fazer isso.",
  limite_diario: "Você já compartilhou 3 vezes hoje. Tente amanhã.",
  ja_compartilhado: "Este evento já foi compartilhado.",
  evento_invalido: "Este evento não pode ser compartilhado.",
  foto_invalida: "Não foi possível anexar a foto.",
  ja_denunciado: "Você já denunciou esta publicação.",
  post_indisponivel: "Esta publicação não está mais disponível.",
  tipo_indisponivel: "Este tipo de evento ainda não está disponível.",
};
export function mensagemErroFeed(e: any): string {
  const msg = String(e?.message ?? e ?? "");
  const chave = Object.keys(ERROS).find((k) => msg.includes(k));
  return chave ? ERROS[chave] : "Não foi possível concluir. Tente novamente.";
}

/** Destaque do cartão: rótulo vermelho + valor grande. */
export function destaquePost(p: Pick<FeedPost, "tipo" | "payload">): { rotulo: string; valor: string; detalhe?: string } {
  const d = p.payload ?? {};
  if (p.tipo === "treino") {
    return {
      rotulo: "Treino concluído",
      valor: d.modalidade ?? "Treino",
      detalhe: [d.horario, d.duracao_min ? `${d.duracao_min} min` : null].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (p.tipo === "sequencia") return { rotulo: "Sequência", valor: `${d.semanas ?? 8} semanas seguidas` };
  if (p.tipo === "recorde") return { rotulo: "Recorde", valor: String(d.valor ?? "") };
  return { rotulo: "Conquista", valor: d.nome ?? "Conquista" };
}

export function tempoRelativo(iso: string, agora = Date.now()): string {
  const s = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export function useFeedStatus() {
  return useQuery({
    queryKey: ["comunidade-feed-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_comunidade_feed_status" as any);
      if (error) throw error;
      return data as unknown as FeedStatus;
    },
  });
}

export function useFeed(filtro: FeedFiltro, enabled: boolean) {
  return useQuery({
    queryKey: ["comunidade-feed", filtro],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_comunidade_feed" as any, { p_filtro: filtro, p_limite: 30 });
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });
}

export function useCompartilhaveis(enabled: boolean) {
  return useQuery({
    queryKey: ["comunidade-compartilhaveis"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_comunidade_compartilhaveis" as any);
      if (error) throw error;
      return data as unknown as Compartilhaveis;
    },
  });
}

/** Links temporários (1 h) das fotos; a leitura é liberada pela política do armazenamento. */
export function useFotosFeed(caminhos: (string | null | undefined)[]) {
  const lista = Array.from(new Set(caminhos.filter(Boolean) as string[])).sort();
  return useQuery({
    queryKey: ["comunidade-feed-fotos", lista],
    enabled: lista.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET_FEED).createSignedUrls(lista, 3600);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl; });
      return mapa;
    },
  });
}

export function validarFotoFeed(f: { type: string; size: number }): string | null {
  if (!(FEED_FOTO_TIPOS as readonly string[]).includes(f.type)) return "Use uma imagem JPG, PNG ou WebP.";
  if (f.size > FEED_FOTO_MAX_BYTES) return "A foto deve ter no máximo 3 MB.";
  return null;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Reduz (1200 px, qualidade 0,8), valida e envia para {aluno_id}/{uuid}.ext. */
export async function enviarFotoFeed(file: File, alunoId: string): Promise<string> {
  const e1 = validarFotoFeed({ type: file.type, size: 0 });
  if (e1) throw new Error(e1);
  const blob = await reduzirCapa(file);
  const e2 = validarFotoFeed({ type: file.type, size: blob.size });
  if (e2) throw new Error(e2);
  const caminho = `${alunoId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET_FEED).upload(caminho, blob, { contentType: file.type });
  if (error) throw error;
  return caminho;
}

/** Apaga fotos do armazenamento (falha silenciosa: a rotina diária apaga o que restar). */
export async function apagarFotosFeed(caminhos: (string | null | undefined)[]) {
  const lista = caminhos.filter(Boolean) as string[];
  if (lista.length) await supabase.storage.from(BUCKET_FEED).remove(lista);
}
