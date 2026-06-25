import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contrato, Cobranca, CicloCredito, Inadimplencia, ResultadoRescisao } from '@/types/financeiro';
import { toast } from 'sonner';

// Supabase generated types not yet aware of the new financial tables — cast through any.
const db = supabase as any;

export function useContratosAluno(alunoId: string) {
  return useQuery({
    queryKey: ['contratos', alunoId],
    queryFn: async () => {
      const { data, error } = await db
        .from('contratos')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contrato[];
    },
    enabled: !!alunoId,
  });
}

export type StatusPagamento = 'pago' | 'pendente' | 'vencida' | 'sem_cobranca';

export type StatusPagamento = 'pago' | 'pendente' | 'vencida' | 'sem_cobranca';

export function useTodosContratos(filtroStatus?: string) {
  return useQuery({
    queryKey: ['contratos', 'todos', filtroStatus],
    queryFn: async () => {
      let query = db
        .from('contratos')
        .select('*, alunos(id, nome, email), cobrancas(data_vencimento, data_pagamento, status)')
        .order('created_at', { ascending: false });
      if (filtroStatus && filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      const { data, error } = await query;
      if (error) throw error;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const list = (data ?? []) as any[];
      return list.map((c) => {
        const cobs = (c.cobrancas ?? []) as any[];
        const pendentes = cobs
          .filter((cb) => cb.status === 'pendente' && cb.data_vencimento)
          .map((cb) => cb.data_vencimento as string)
          .sort();
        const proxima_cobranca = pendentes[0] ?? null;

        let status_pagamento: StatusPagamento = 'sem_cobranca';
        if (proxima_cobranca) {
          const venc = new Date(proxima_cobranca + 'T00:00:00');
          status_pagamento = venc < hoje ? 'vencida' : 'pendente';
        } else if (cobs.some((cb) => cb.status === 'pago')) {
          status_pagamento = 'pago';
        }
        return { ...c, proxima_cobranca, status_pagamento };
      }) as (Contrato & { proxima_cobranca: string | null; status_pagamento: StatusPagamento })[];
    },
  });
}

export interface CobrancaListagem extends Cobranca {
  status_pagamento: StatusPagamento;
  contratos?: {
    id: string;
    plano_tipo: string;
    frequencia_semanal: number;
    forma_pagamento: string;
    status: string;
    aluno_id: string;
    alunos?: { id: string; nome: string; email?: string };
  };
}

export function useCobrancasListagem(filtroStatusContrato?: string) {
  return useQuery({
    queryKey: ['cobrancas', 'listagem', filtroStatusContrato],
    queryFn: async () => {
      const { data, error } = await db
        .from('cobrancas')
        .select('*, contratos!inner(id, plano_tipo, frequencia_semanal, forma_pagamento, status, aluno_id, alunos(id, nome, email))')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      let list = (data ?? []) as any[];
      if (filtroStatusContrato && filtroStatusContrato !== 'todos') {
        list = list.filter((cb) => cb.contratos?.status === filtroStatusContrato);
      }
      return list.map((cb) => {
        let status_pagamento: StatusPagamento;
        if (cb.status === 'pago') status_pagamento = 'pago';
        else if (cb.status === 'pendente' && cb.data_vencimento) {
          const venc = new Date(cb.data_vencimento + 'T00:00:00');
          status_pagamento = venc < hoje ? 'vencida' : 'pendente';
        } else status_pagamento = 'sem_cobranca';
        return { ...cb, status_pagamento };
      }) as CobrancaListagem[];
    },
  });
}

export function useCobrancasContrato(contratoId: string) {
  return useQuery({
    queryKey: ['cobrancas', contratoId],
    queryFn: async () => {
      const { data, error } = await db
        .from('cobrancas')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('numero_ciclo', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Cobranca[];
    },
    enabled: !!contratoId,
  });
}


export function useCiclosCredito(contratoId: string) {
  return useQuery({
    queryKey: ['ciclos_credito', contratoId],
    queryFn: async () => {
      const { data, error } = await db
        .from('ciclos_credito')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CicloCredito[];
    },
    enabled: !!contratoId,
  });
}

export function useInadimplenciasAbertas() {
  return useQuery({
    queryKey: ['inadimplencias', 'abertas'],
    queryFn: async () => {
      const { data, error } = await db
        .from('inadimplencias_view')
        .select('*, alunos(id, nome), contratos(plano_tipo, forma_pagamento)')
        .eq('status', 'aberta')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return (data ?? []) as (Inadimplencia & { alunos: { id: string; nome: string } })[];
    },
  });
}

export function useCalcularRescisao(contratoId: string, enabled = true) {
  return useQuery({
    queryKey: ['rescisao', contratoId],
    queryFn: async () => {
      const { data, error } = await db.rpc('fn_calcular_rescisao', { p_contrato_id: contratoId });
      if (error) throw error;
      return data as ResultadoRescisao;
    },
    enabled: !!contratoId && enabled,
    staleTime: 30_000,
  });
}

export function useCriarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Contrato, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await db.from('contratos').insert(payload).select().single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: () => {
      toast.success('Contrato criado com sucesso');
      qc.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (e: any) => toast.error('Erro ao criar contrato: ' + e.message),
  });
}

export function useCancelarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await db
        .from('contratos')
        .update({
          status: 'cancelado',
          data_cancelamento: new Date().toISOString().split('T')[0],
          motivo_cancelamento: motivo ?? 'Cancelamento solicitado pelo usuário',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contrato cancelado');
      qc.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (e: any) => toast.error('Erro ao cancelar: ' + e.message),
  });
}

export function useRegistrarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaId, dataPagamento, comprovante_url }: {
      cobrancaId: string; dataPagamento: string; comprovante_url?: string;
    }) => {
      const { error } = await db
        .from('cobrancas')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          meio_registro: 'manual_admin',
          ...(comprovante_url ? { comprovante_url } : {}),
        })
        .eq('id', cobrancaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento registrado');
      qc.invalidateQueries({ queryKey: ['cobrancas'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (e: any) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });
}
