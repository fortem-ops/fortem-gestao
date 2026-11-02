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
