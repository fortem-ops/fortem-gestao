import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseMutation } from './useSupabaseMutation';
import type {
  ContratoTemplate,
  RegulamentoInternoVersao,
} from '@/types/contratoTemplates';
import { PLANOS_ORDEM } from '@/types/contratoTemplates';
import type { PlanoTipo, FormaPagamento } from '@/types/financeiro';

const db = supabase as any;

export function useContratoTemplates() {
  return useQuery({
    queryKey: ['contrato_templates', 'ativos'],
    queryFn: async () => {
      const { data, error } = await db
        .from('contrato_templates')
        .select('*')
        .eq('ativo', true);
      if (error) throw error;
      const list = (data ?? []) as ContratoTemplate[];
      const idx = (p: PlanoTipo) => {
        const i = PLANOS_ORDEM.indexOf(p);
        return i === -1 ? 999 : i;
      };
      return list.sort((a, b) => {
        const d = idx(a.plano_tipo) - idx(b.plano_tipo);
        if (d !== 0) return d;
        return a.forma_pagamento.localeCompare(b.forma_pagamento);
      });
    },
  });
}

export function useRegulamentoInternoAtivo() {
  return useQuery({
    queryKey: ['regulamento_interno', 'ativo'],
    queryFn: async () => {
      const { data, error } = await db
        .from('regulamento_interno_versoes')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RegulamentoInternoVersao | null;
    },
  });
}

export function useHistoricoTemplate(plano_tipo?: PlanoTipo, forma_pagamento?: FormaPagamento) {
  return useQuery({
    queryKey: ['contrato_templates', 'historico', plano_tipo, forma_pagamento],
    queryFn: async () => {
      const { data, error } = await db
        .from('contrato_templates')
        .select('*')
        .eq('plano_tipo', plano_tipo)
        .eq('forma_pagamento', forma_pagamento)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContratoTemplate[];
    },
    enabled: !!plano_tipo && !!forma_pagamento,
  });
}

export function useHistoricoRegulamento() {
  return useQuery({
    queryKey: ['regulamento_interno', 'historico'],
    queryFn: async () => {
      const { data, error } = await db
        .from('regulamento_interno_versoes')
        .select('*')
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegulamentoInternoVersao[];
    },
  });
}

interface SalvarTemplateInput {
  plano_tipo: PlanoTipo;
  forma_pagamento: FormaPagamento;
  nome: string;
  conteudo: string;
}

export function useSalvarContratoTemplate() {
  return useSupabaseMutation<ContratoTemplate, SalvarTemplateInput>({
    mutationFn: async ({ plano_tipo, forma_pagamento, nome, conteudo }) => {
      // Busca versão atual ativa (se houver)
      const { data: atual, error: errAtual } = await db
        .from('contrato_templates')
        .select('id, versao')
        .eq('plano_tipo', plano_tipo)
        .eq('forma_pagamento', forma_pagamento)
        .eq('ativo', true)
        .maybeSingle();
      if (errAtual) throw errAtual;

      const proximaVersao = (atual?.versao ?? 0) + 1;

      // Marca a atual como inativa
      if (atual?.id) {
        const { error: errUpd } = await db
          .from('contrato_templates')
          .update({ ativo: false })
          .eq('id', atual.id);
        if (errUpd) throw errUpd;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await db
        .from('contrato_templates')
        .insert({
          plano_tipo,
          forma_pagamento,
          nome,
          conteudo,
          versao: proximaVersao,
          ativo: true,
          criado_por: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContratoTemplate;
    },
    successMessage: 'Nova versão do template salva',
    invalidates: [['contrato_templates']],
  });
}

export function useCriarContratoTemplate() {
  return useSupabaseMutation<ContratoTemplate, SalvarTemplateInput>({
    mutationFn: async ({ plano_tipo, forma_pagamento, nome, conteudo }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await db
        .from('contrato_templates')
        .insert({
          plano_tipo,
          forma_pagamento,
          nome,
          conteudo,
          versao: 1,
          ativo: true,
          criado_por: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContratoTemplate;
    },
    successMessage: 'Template criado',
    invalidates: [['contrato_templates']],
  });
}

export function useSalvarRegulamentoInterno() {
  return useSupabaseMutation<RegulamentoInternoVersao, { conteudo: string }>({
    mutationFn: async ({ conteudo }) => {
      const { data: atual, error: errAtual } = await db
        .from('regulamento_interno_versoes')
        .select('id, versao')
        .eq('ativo', true)
        .maybeSingle();
      if (errAtual) throw errAtual;

      const proximaVersao = (atual?.versao ?? 0) + 1;

      if (atual?.id) {
        const { error: errUpd } = await db
          .from('regulamento_interno_versoes')
          .update({ ativo: false })
          .eq('id', atual.id);
        if (errUpd) throw errUpd;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await db
        .from('regulamento_interno_versoes')
        .insert({
          conteudo,
          versao: proximaVersao,
          ativo: true,
          criado_por: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RegulamentoInternoVersao;
    },
    successMessage: 'Nova versão do regulamento salva',
    invalidates: [['regulamento_interno']],
  });
}
