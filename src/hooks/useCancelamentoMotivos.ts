import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CancelamentoMotivo {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem: number;
}

export function useCancelamentoMotivos(includeInactive = false) {
  return useQuery({
    queryKey: ["cancelamento-motivos", includeInactive],
    queryFn: async () => {
      let q = supabase.from("cancelamento_motivos" as any)
        .select("id,nome,slug,ativo,ordem")
        .order("ordem")
        .order("nome");
      if (!includeInactive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CancelamentoMotivo[];
    },
  });
}

export function useCancelamentoMotivoMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cancelamento-motivos"] });
  };

  const create = useMutation({
    mutationFn: async (input: { nome: string; slug: string; ordem?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("cancelamento_motivos" as any).insert({
        nome: input.nome.trim(),
        slug: input.slug.trim(),
        ordem: input.ordem ?? 99,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create };
}
