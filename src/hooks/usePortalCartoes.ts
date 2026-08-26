import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PortalCartao {
  id: string;
  brand: string | null;
  last4: string | null;
  holder_name: string | null;
  expiration_month: number | null;
  expiration_year: number | null;
  is_default: boolean | null;
  ativo: boolean | null;
}

/**
 * Cartões salvos do próprio aluno no Portal.
 *
 * Regras importantes:
 * - "definir principal" aplica `is_default = true` no cartão escolhido ANTES de
 *   limpar os demais. Se a segunda etapa falhar, o aluno fica com dois cartões
 *   marcados (estado corrigível) em vez de nenhum principal — que faria a
 *   cobrança automática de recorrência escolher cartão de forma indefinida.
 * - remoção é sempre soft delete (`ativo = false`), preservando o histórico do
 *   token usado em cobranças passadas.
 *
 * A RLS (`cartoes_self_select` / `cartoes_self_update`) já restringe ao próprio
 * aluno, e o trigger `cartoes_salvos_protect_immutable` impede a alteração de
 * token/validade/last4 pelo cliente — por isso não é necessária RPC ou edge
 * function para estas duas ações.
 */
export function usePortalCartoes(alunoId?: string) {
  const qc = useQueryClient();
  const queryKey = ["portal-cartoes", alunoId];

  const query = useQuery({
    queryKey,
    enabled: !!alunoId,
    queryFn: async (): Promise<PortalCartao[]> => {
      const { data, error } = await (supabase as any)
        .from("cartoes_salvos")
        .select("id, brand, last4, holder_name, expiration_month, expiration_year, is_default, ativo")
        .eq("aluno_id", alunoId)
        .eq("ativo", true)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalCartao[];
    },
  });

  const refetchLista = async () => {
    await qc.invalidateQueries({ queryKey: ["portal-cartoes"] });
    await query.refetch();
  };

  const definirPrincipal = useMutation({
    mutationFn: async (cartaoId: string) => {
      if (!alunoId) throw new Error("Aluno não identificado");

      // 1) o escolhido passa a ser principal primeiro
      const { error } = await (supabase as any)
        .from("cartoes_salvos")
        .update({ is_default: true })
        .eq("id", cartaoId)
        .eq("aluno_id", alunoId);
      if (error) throw error;

      // 2) os demais ativos perdem o principal
      const { error: limpaErr } = await (supabase as any)
        .from("cartoes_salvos")
        .update({ is_default: false })
        .eq("aluno_id", alunoId)
        .eq("ativo", true)
        .neq("id", cartaoId);
      if (limpaErr) throw limpaErr;
    },
    // sucesso ou falha, a lista é relida do banco (sem estado otimista)
    onSettled: refetchLista,
    onSuccess: () => toast.success("Cartão principal atualizado"),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o cartão principal"),
  });

  const removerCartao = useMutation({
    mutationFn: async (cartaoId: string) => {
      if (!alunoId) throw new Error("Aluno não identificado");
      const { error } = await (supabase as any)
        .from("cartoes_salvos")
        .update({ ativo: false, is_default: false })
        .eq("id", cartaoId)
        .eq("aluno_id", alunoId);
      if (error) throw error;
    },
    onSettled: refetchLista,
    onSuccess: () => toast.success("Cartão removido"),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover o cartão"),
  });

  return {
    cartoes: query.data ?? [],
    isLoading: query.isLoading,
    refetchLista,
    definirPrincipal,
    removerCartao,
  };
}
