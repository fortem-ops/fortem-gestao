import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contrato, Cobranca, CicloCredito, Inadimplencia, ResultadoRescisao } from '@/types/financeiro';
import { toast } from 'sonner';
import { getFormaRecebimento } from '@/lib/formasRecebimento';


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

/** Busca todas as linhas em páginas de 1000 (contorna o limite padrão do PostgREST). */
async function fetchAllPages<T = any>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  let all: T[] = [];
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat((data ?? []) as T[]);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Mapa aluno_id -> tipo do plano ativo (fonte confiável, em vez de contratos.plano_tipo). */
async function fetchPlanoRealMap(): Promise<Map<string, string>> {
  const rows = await fetchAllPages<any>((from, to) =>
    db.from('planos').select('aluno_id, tipo').eq('ativo', true).range(from, to)
  );
  const map = new Map<string, string>();
  for (const p of rows) {
    if (p?.aluno_id && p?.tipo && !map.has(p.aluno_id)) map.set(p.aluno_id, p.tipo);
  }
  return map;
}

export function useTodosContratos(filtroStatus?: string) {
  return useQuery({
    queryKey: ['contratos', 'todos', filtroStatus],
    queryFn: async () => {
      const [data, planoMap] = await Promise.all([
        fetchAllPages<any>((from, to) => {
          let query = db
            .from('contratos')
            .select('*, alunos(id, nome, email), cobrancas(data_vencimento, data_pagamento, status)')
            .order('created_at', { ascending: false })
            .range(from, to);
          if (filtroStatus && filtroStatus !== 'todos') {
            query = query.eq('status', filtroStatus);
          }
          return query;
        }),
        fetchPlanoRealMap(),
      ]);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const list = (data ?? []) as any[];
      return list.map((c) => {
        const cobs = (c.cobrancas ?? []) as any[];
        const pendentes = cobs
          .filter((cb) => (cb.status === 'pendente' || cb.status === 'atrasado') && cb.data_vencimento)
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
        return { ...c, proxima_cobranca, status_pagamento, plano_real_tipo: planoMap.get(c.aluno_id) ?? null };
      }) as (Contrato & { proxima_cobranca: string | null; status_pagamento: StatusPagamento; plano_real_tipo: string | null })[];
    },
  });
}

export interface CobrancaListagem extends Cobranca {
  status_pagamento: StatusPagamento;
  plano_real_tipo?: string | null;
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
      const [data, planoMap] = await Promise.all([
        fetchAllPages<any>((from, to) =>
          db
            .from('cobrancas')
            .select('*, contratos!inner(id, plano_tipo, frequencia_semanal, forma_pagamento, status, aluno_id, alunos(id, nome, email))')
            .order('data_vencimento', { ascending: true })
            .range(from, to)
        ),
        fetchPlanoRealMap(),
      ]);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      let list = (data ?? []) as any[];
      if (filtroStatusContrato && filtroStatusContrato !== 'todos') {
        list = list.filter((cb) => cb.contratos?.status === filtroStatusContrato);
      }
      return list.map((cb) => {
        let status_pagamento: StatusPagamento;
        if (cb.status === 'pago') status_pagamento = 'pago';
        else if ((cb.status === 'pendente' || cb.status === 'atrasado') && cb.data_vencimento) {
          const venc = new Date(cb.data_vencimento + 'T00:00:00');
          status_pagamento = venc < hoje ? 'vencida' : 'pendente';
        } else status_pagamento = 'sem_cobranca';
        return { ...cb, status_pagamento, plano_real_tipo: planoMap.get(cb.aluno_id) ?? null };
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
      const rows = (data ?? []) as any[];

      // Ignora inadimplências cuja cobrança já foi paga ou cancelada
      // (ex.: contrato encerrado/rescindido) — não são atrasos reais.
      const cobrancaIds = Array.from(
        new Set(rows.map((r) => r.cobranca_id).filter(Boolean)),
      );
      if (cobrancaIds.length) {
        const { data: cobs } = await db
          .from('cobrancas')
          .select('id, status')
          .in('id', cobrancaIds);
        const invalidas = new Set(
          (cobs ?? [])
            .filter((c: any) => c.status === 'pago' || c.status === 'cancelado' || c.status === 'isento')
            .map((c: any) => c.id),
        );
        if (invalidas.size) {
          return rows.filter((r) => !invalidas.has(r.cobranca_id)) as (Inadimplencia & {
            alunos: { id: string; nome: string };
          })[];
        }
      }
      return rows as (Inadimplencia & { alunos: { id: string; nome: string } })[];
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
    mutationFn: async ({ cobrancaId, dataPagamento, formaRecebimento, comprovante_url }: {
      cobrancaId: string; dataPagamento: string; formaRecebimento: string; comprovante_url?: string;
    }) => {
      const forma = getFormaRecebimento(formaRecebimento);
      if (!forma) throw new Error('Forma de recebimento inválida');
      const { error } = await db
        .from('cobrancas')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          forma_pagamento: forma.value,
          gateway: forma.gateway,
          meio_registro: 'manual_admin',
          ...(comprovante_url ? { comprovante_url } : {}),
        })
        .eq('id', cobrancaId);
      if (error) throw error;

      await (db as any)
        .from('vendas')
        .update({ forma_pagamento: forma.vendaForma, status_pagamento: 'pago' })
        .eq('cobranca_id', cobrancaId)
        .or('forma_pagamento.is.null,forma_pagamento.eq.pendente');

      await db
        .from('inadimplencias')
        .update({ status: 'regularizada', data_regularizacao: dataPagamento })
        .eq('cobranca_id', cobrancaId)
        .eq('status', 'aberta');
    },
    onSuccess: () => {
      toast.success('Pagamento registrado');
      qc.invalidateQueries({ queryKey: ['cobrancas'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['inadimplencias', 'abertas'] });
    },
    onError: (e: any) => toast.error('Erro ao registrar pagamento: ' + e.message),
  });
}

/** Baixa retroativa em lote de cobranças vencidas. */
export function useDarBaixaLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaIds, dataPagamento, formaRecebimento }: {
      cobrancaIds: string[]; dataPagamento: string; formaRecebimento?: string;
    }) => {
      if (!cobrancaIds.length) return 0;
      const forma = formaRecebimento ? getFormaRecebimento(formaRecebimento) : undefined;
      const { error } = await db
        .from('cobrancas')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          meio_registro: 'manual_admin',
          ...(forma ? { forma_pagamento: forma.value, gateway: forma.gateway } : {}),
        })
        .in('id', cobrancaIds);
      if (error) throw error;

      if (forma) {
        await (db as any)
          .from('vendas')
          .update({ forma_pagamento: forma.vendaForma, status_pagamento: 'pago' })
          .in('cobranca_id', cobrancaIds)
          .or('forma_pagamento.is.null,forma_pagamento.eq.pendente');
      }

      await db
        .from('inadimplencias')
        .update({ status: 'regularizada', data_regularizacao: dataPagamento })
        .in('cobranca_id', cobrancaIds)
        .eq('status', 'aberta');

      return cobrancaIds.length;
    },
    onSuccess: (qtd) => {
      toast.success(`${qtd} cobrança(s) regularizada(s)`);
      qc.invalidateQueries({ queryKey: ['cobrancas'] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['inadimplencias', 'abertas'] });
    },
    onError: (e: any) => toast.error('Erro ao dar baixa em lote: ' + e.message),
  });
}

