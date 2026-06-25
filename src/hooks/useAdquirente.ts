import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AdquirenteTaxa, AdquirenteConfig } from '@/types/adquirente';

export function useAdquirente(adquirente: string = 'rede') {
  const qc = useQueryClient();

  const taxasQ = useQuery({
    queryKey: ['adquirente-taxas', adquirente],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adquirentes_taxas')
        .select('*')
        .eq('adquirente', adquirente);
      if (error) throw error;
      return (data ?? []) as AdquirenteTaxa[];
    },
  });

  const configQ = useQuery({
    queryKey: ['adquirente-config', adquirente],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adquirentes_config')
        .select('*')
        .eq('adquirente', adquirente)
        .maybeSingle();
      if (error) throw error;
      return data as AdquirenteConfig | null;
    },
  });

  const salvar = useMutation({
    mutationFn: async (payload: {
      taxas: { id: string; taxa_percentual: number }[];
      aluguel_mensal: number;
    }) => {
      const updates = await Promise.all(
        payload.taxas.map((t) =>
          supabase
            .from('adquirentes_taxas')
            .update({ taxa_percentual: t.taxa_percentual })
            .eq('id', t.id),
        ),
      );
      const firstErr = updates.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;

      const { error: cfgErr } = await supabase
        .from('adquirentes_config')
        .upsert(
          { adquirente, aluguel_mensal: payload.aluguel_mensal },
          { onConflict: 'adquirente' },
        );
      if (cfgErr) throw cfgErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adquirente-taxas', adquirente] });
      qc.invalidateQueries({ queryKey: ['adquirente-config', adquirente] });
    },
  });

  return { taxasQ, configQ, salvar };
}
