import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const CHAVE_COBRANCA_RECORRENTE = "cobranca_recorrente_ativa";

/** Lê uma chave booleana de sistema_config. Falha fechada: erro/ausente => false. */
export function useSistemaConfigBool(chave: string) {
  return useQuery({
    queryKey: ["sistema-config", chave],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("sistema_config")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();
      if (error) return false;
      return data?.valor === true;
    },
    staleTime: 30_000,
  });
}

/** Grava uma chave booleana de sistema_config (apenas admin, por RLS). */
export function useSetSistemaConfigBool(chave: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: boolean) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("sistema_config")
        .update({
          valor: valor as unknown as never,
          updated_at: new Date().toISOString(),
          updated_by: userData?.user?.id ?? null,
        })
        .eq("chave", chave);
      if (error) throw error;
      return valor;
    },
    onSuccess: (valor) => {
      qc.invalidateQueries({ queryKey: ["sistema-config", chave] });
      toast.success(valor ? "Cobrança automática ativada" : "Cobrança automática pausada");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar a configuração");
    },
  });
}

/** Atalho para a trava da cobrança automática no cartão. */
export function useCobrancaRecorrenteAtiva() {
  return useSistemaConfigBool(CHAVE_COBRANCA_RECORRENTE);
}
