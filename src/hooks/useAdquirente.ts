import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BANDEIRAS_PADRAO,
  MODALIDADES,
  type AdquirenteTaxa,
  type AdquirenteConfig,
  type Bandeira,
  type MeioPagamentoConfig,
  type PrazoUnidade,
} from '@/types/adquirente';

export function useAdquirente(adquirente: string = 'rede') {
  const qc = useQueryClient();

  const adquirentesDisponiveisQ = useQuery({
    queryKey: ['adquirentes-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('adquirentes_config').select('adquirente');
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.adquirente))).sort();
    },
  });

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
      taxas: {
        id: string;
        taxa_percentual: number;
        prazo_recebimento_dias: number;
        prazo_unidade: PrazoUnidade;
        intervalo_parcelas_dias: number | null;
      }[];
      aluguel_mensal: number;
      bandeira_padrao: Bandeira;
    }) => {
      const updates = await Promise.all(
        payload.taxas.map((t) =>
          supabase
            .from('adquirentes_taxas')
            .update({
              taxa_percentual: t.taxa_percentual,
              prazo_recebimento_dias: t.prazo_recebimento_dias,
              prazo_unidade: t.prazo_unidade,
              intervalo_parcelas_dias: t.intervalo_parcelas_dias,
            })
            .eq('id', t.id),
        ),
      );
      const firstErr = updates.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;

      const { error: cfgErr } = await supabase
        .from('adquirentes_config')
        .upsert(
          { adquirente, aluguel_mensal: payload.aluguel_mensal, bandeira_padrao: payload.bandeira_padrao },
          { onConflict: 'adquirente' },
        );
      if (cfgErr) throw cfgErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adquirente-taxas', adquirente] });
      qc.invalidateQueries({ queryKey: ['adquirente-config', adquirente] });
    },
  });

  const criarAdquirente = useMutation({
    mutationFn: async (nome: string) => {
      const { error: cfgErr } = await supabase
        .from('adquirentes_config')
        .insert({ adquirente: nome, aluguel_mensal: 0 });
      if (cfgErr) throw cfgErr;
      const rows = BANDEIRAS_PADRAO.flatMap((b) =>
        MODALIDADES.map((m) => ({
          adquirente: nome,
          bandeira: b.value,
          modalidade: m.value,
          taxa_percentual: 0,
          prazo_recebimento_dias: 0,
          prazo_unidade: 'corridos',
        })),
      );
      const { error } = await supabase.from('adquirentes_taxas').insert(rows);
      if (error) throw error;
      return nome;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adquirentes-disponiveis'] });
      qc.invalidateQueries({ queryKey: ['adquirente-taxas'] });
      qc.invalidateQueries({ queryKey: ['adquirente-config'] });
    },
  });

  const adicionarBandeira = useMutation({
    mutationFn: async (nome: string) => {
      const nomeNormalizado = nome.trim().toLowerCase();
      if (!nomeNormalizado) throw new Error('Informe o nome da bandeira.');
      const existentes = new Set((taxasQ.data ?? []).map((t) => t.bandeira));
      if (existentes.has(nomeNormalizado)) {
        throw new Error(`A bandeira "${nomeNormalizado.toUpperCase()}" já existe para este adquirente.`);
      }
      const rows = MODALIDADES.map((m) => ({
        adquirente,
        bandeira: nomeNormalizado,
        modalidade: m.value,
        taxa_percentual: 0,
        prazo_recebimento_dias: 0,
        prazo_unidade: 'corridos',
      }));
      const { error } = await supabase.from('adquirentes_taxas').insert(rows);
      if (error) throw error;
      return nomeNormalizado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adquirente-taxas', adquirente] });
    },
  });

  return { adquirentesDisponiveisQ, taxasQ, configQ, salvar, criarAdquirente, adicionarBandeira };
}

export function useMeiosPagamento() {
  const qc = useQueryClient();

  const meiosQ = useQuery({
    queryKey: ['meios-pagamento'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meios_pagamento_config').select('*').order('meio');
      if (error) throw error;
      return (data ?? []) as MeioPagamentoConfig[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (
      itens: Pick<MeioPagamentoConfig, 'meio' | 'taxa_percentual' | 'prazo_recebimento_dias' | 'prazo_unidade' | 'ativo'>[],
    ) => {
      const res = await Promise.all(
        itens.map((i) =>
          supabase
            .from('meios_pagamento_config')
            .update({
              taxa_percentual: i.taxa_percentual,
              prazo_recebimento_dias: i.prazo_recebimento_dias,
              prazo_unidade: i.prazo_unidade,
              ativo: i.ativo,
            })
            .eq('meio', i.meio),
        ),
      );
      const err = res.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meios-pagamento'] }),
  });

  return { meiosQ, salvar };
}
