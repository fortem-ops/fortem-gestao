import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadOrigem {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export function useLeadOrigens(includeInactive = false) {
  return useQuery({
    queryKey: ["lead-origens", includeInactive],
    queryFn: async () => {
      let q = supabase.from("lead_origens" as any).select("id,nome,ativo,ordem").order("ordem").order("nome");
      if (!includeInactive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LeadOrigem[];
    },
  });
}

export function useLeadOrigemMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lead-origens"] });
  };

  const create = useMutation({
    mutationFn: async (input: { nome: string; ordem?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_origens" as any).insert({
        nome: input.nome.trim(),
        ordem: input.ordem ?? 0,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; nome?: string; ativo?: boolean; ordem?: number }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("lead_origens" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_origens" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
