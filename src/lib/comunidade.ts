import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComunidadeClube = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: "oficial" | "aluno";
  modalidade: "todas" | "funcional" | "corrida";
  status: "pendente" | "ativo" | "recusado" | "encerrado";
  motivo_recusa: string | null;
  capa_url: string | null;
  sou_criador: boolean;
  sou_membro: boolean;
  membros: number;
  anfitriao: string | null;
  minha_posicao: number | null;
  meus_dias: number | null;
};

export type LinhaRanking = { posicao: number; nome: string; plano_chave: string | null; dias: number; eh_voce: boolean };

export const MODALIDADES: { valor: ComunidadeClube["modalidade"]; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "funcional", rotulo: "Funcional" },
  { valor: "corrida", rotulo: "Corrida" },
];

export const AVISO_VISIBILIDADE = "Seu nome abreviado e seus dias de treino ficam visíveis para os membros deste clube.";

/** Iniciais de um nome já abreviado ("Carolina M." -> "CM"). */
export function iniciaisAbrev(nome?: string | null): string {
  const p = (nome ?? "").replace(/\./g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const ERROS: Record<string, string> = {
  nome_reservado: "Nomes com Fortem ou Oficial são reservados à equipe.",
  limite_pendente: "Você já tem um clube em análise.",
  limite_ativos: "Você já tem 2 clubes ativos criados.",
  clube_indisponivel: "Este clube não está disponível.",
  sem_acesso_ranking: "O ranking é visível só para membros.",
  comunidade_clubes_nome_unico: "Já existe um clube com este nome.",
  motivo_obrigatorio: "Informe o motivo da recusa.",
  descricao_longa: "A descrição deve ter no máximo 120 caracteres.",
  capa_invalida: "Imagem de capa inválida.",
  comunidade_clubes_descricao_120: "A descrição deve ter no máximo 120 caracteres.",
};
export function mensagemErroComunidade(e: any): string {
  const msg = String(e?.message ?? e ?? "");
  const chave = Object.keys(ERROS).find((k) => msg.includes(k));
  return chave ? ERROS[chave] : "Não foi possível concluir. Tente novamente.";
}

export function useMeusClubes(enabled = true) {
  return useQuery({
    queryKey: ["comunidade-clubes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_comunidade_meus_clubes" as any);
      if (error) throw error;
      return (data ?? []) as unknown as ComunidadeClube[];
    },
  });
}

export function useRankingClube(clubeId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["comunidade-ranking", clubeId],
    enabled: !!clubeId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_comunidade_ranking_clube" as any, { p_clube_id: clubeId });
      if (error) throw error;
      return (data ?? []) as LinhaRanking[];
    },
  });
}

// ---- Capa dos clubes (bucket privado "comunidade-clubes"; capa_url guarda o caminho do objeto) ----
export const BUCKET_CAPAS = "comunidade-clubes";
export const CAPA_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const CAPA_MAX_BYTES = 2 * 1024 * 1024;
export const DESCRICAO_MAX = 120;
export const ORIENTACAO_CAPA = "Use uma ilustração ou logo. Não use fotos de pessoas.";

/** Valida tipo/tamanho de um arquivo de capa. Retorna mensagem de erro ou null. */
export function validarArquivoCapa(f: { type: string; size: number }): string | null {
  if (!(CAPA_TIPOS as readonly string[]).includes(f.type)) return "Use uma imagem JPG, PNG ou WebP.";
  if (f.size > CAPA_MAX_BYTES) return "A imagem deve ter no máximo 2 MB.";
  return null;
}

/** Reduz no navegador para largura máx. 1200 px, qualidade 0,8 (mantém PNG como PNG). */
export async function reduzirCapa(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1200 / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const tipo = file.type === "image/png" ? "image/png" : file.type;
  return await new Promise<Blob>((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error("falha_reducao"))), tipo, 0.8),
  );
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Reduz, valida e envia para {pasta}/{uuid}.ext. Retorna o caminho gravado. */
export async function enviarCapa(file: File, pasta: string): Promise<string> {
  const erroInicial = validarArquivoCapa({ type: file.type, size: 0 });
  if (erroInicial) throw new Error(erroInicial);
  const blob = await reduzirCapa(file);
  const erro = validarArquivoCapa({ type: file.type, size: blob.size });
  if (erro) throw new Error(erro);
  const caminho = `${pasta}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET_CAPAS).upload(caminho, blob, { contentType: file.type });
  if (error) throw error;
  return caminho;
}

/** Links temporários (1 h) para exibir as capas. */
export function useCapasClubes(caminhos: (string | null | undefined)[]) {
  const lista = Array.from(new Set(caminhos.filter(Boolean) as string[])).sort();
  return useQuery({
    queryKey: ["comunidade-capas", lista],
    enabled: lista.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET_CAPAS).createSignedUrls(lista, 3600);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl; });
      return mapa;
    },
  });
}
