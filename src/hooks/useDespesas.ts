import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Despesa, DespesaCategoria, DespesaInput, DespesaRecorrenciaInput, DespesaTipo, Fornecedor, FornecedorInput,
} from '@/types/despesas';

/** Busca despesas com data_competencia entre inicio e fim (inclusive), paginando em lotes de 1000. */
async function fetchDespesas(inicio: string, fim: string): Promise<Despesa[]> {
  const out: Despesa[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('despesas')
      .select('*')
      .gte('data_competencia', inicio)
      .lte('data_competencia', fim)
      .order('data_competencia', { ascending: false })
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Despesa[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useDespesasPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['despesas', inicio, fim],
    queryFn: () => fetchDespesas(inicio, fim),
    // Ao trocar de mês, mantém a tela anterior visível enquanto carrega (sem piscar o "carregando").
    placeholderData: keepPreviousData,
  });
}

export function useCategoriasDespesa(apenasAtivas = false) {
  return useQuery({
    queryKey: ['despesas-categorias', apenasAtivas],
    queryFn: async () => {
      let q = supabase.from('despesas_categorias').select('*').order('tipo').order('nome');
      if (apenasAtivas) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DespesaCategoria[];
    },
  });
}

/** Contagem de despesas por categoria (para bloquear exclusão de categorias em uso). */
export function useUsoCategorias() {
  return useQuery({
    queryKey: ['despesas-categorias-uso'],
    queryFn: async () => {
      const map: Record<string, number> = {};
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('despesas').select('categoria_id').order('id').range(from, from + 999);
        if (error) throw error;
        (data ?? []).forEach((r) => { if (r.categoria_id) map[r.categoria_id] = (map[r.categoria_id] ?? 0) + 1; });
        if (!data || data.length < 1000) break;
      }
      return map;
    },
  });
}

/** Campos que se propagam para as demais parcelas de um grupo (datas e status não). */
type CamposGrupo = Pick<DespesaInput,
  'categoria_id' | 'descricao' | 'valor' | 'tipo' | 'observacao' | 'forma_pagamento' | 'conta_bancaria' | 'fornecedor_id'>;

export function useDespesaMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['despesas'] });
    qc.invalidateQueries({ queryKey: ['despesas-categorias-uso'] });
  };
  const uidAtual = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const salvar = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: DespesaInput }) => {
      const uid = await uidAtual();
      if (id) {
        const { error } = await supabase.from('despesas').update({ ...input, updated_by: uid }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('despesas').insert({ ...input, origem: 'manual', created_by: uid, updated_by: uid });
        if (error) throw error;
      }
    },
    onSuccess: inval,
  });

  /** Cria várias despesas de uma vez (repetição de lançamento). */
  const criarLote = useMutation({
    mutationFn: async (linhas: (DespesaInput & DespesaRecorrenciaInput)[]) => {
      const uid = await uidAtual();
      const { error } = await supabase.from('despesas')
        .insert(linhas.map((l) => ({ ...l, origem: 'manual', created_by: uid, updated_by: uid })));
      if (error) throw error;
    },
    onSuccess: inval,
  });

  /** Aplica campos comuns às parcelas seguintes ainda pendentes do grupo. */
  const atualizarFuturasGrupo = useMutation({
    mutationFn: async ({ grupoId, aPartirDe, campos }: { grupoId: string; aPartirDe: number; campos: CamposGrupo }) => {
      const uid = await uidAtual();
      const { error } = await supabase.from('despesas')
        .update({ ...campos, updated_by: uid })
        .eq('grupo_recorrencia_id', grupoId).eq('status', 'pendente').gt('parcela_atual', aPartirDe);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('despesas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  /** Exclui este lançamento e as parcelas seguintes ainda pendentes do grupo. */
  const excluirFuturasGrupo = useMutation({
    mutationFn: async ({ id, grupoId, aPartirDe }: { id: string; grupoId: string; aPartirDe: number }) => {
      const { error: e1 } = await supabase.from('despesas').delete().eq('id', id);
      if (e1) throw e1;
      const { error } = await supabase.from('despesas').delete()
        .eq('grupo_recorrencia_id', grupoId).eq('status', 'pendente').gt('parcela_atual', aPartirDe);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const alternarConciliado = useMutation({
    mutationFn: async ({ id, conciliado }: { id: string; conciliado: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('despesas')
        .update({ conciliado, updated_by: u.user?.id ?? null }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, conciliado }) => {
      await qc.cancelQueries({ queryKey: ['despesas'] });
      const snaps = qc.getQueriesData<Despesa[]>({ queryKey: ['despesas'] });
      snaps.forEach(([k, v]) => v && qc.setQueryData(k, v.map((d) => (d.id === id ? { ...d, conciliado } : d))));
      return { snaps };
    },
    onError: (_e, _v, ctx) => ctx?.snaps.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['despesas'] }),
  });

  return { salvar, criarLote, atualizarFuturasGrupo, excluir, excluirFuturasGrupo, alternarConciliado };
}

export function useCategoriaMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['despesas-categorias'] });

  /** Cria ou edita uma subcategoria. Centrais não são criadas pela interface. */
  const salvarSub = useMutation({
    mutationFn: async ({ id, nome, tipo, ordem, pai }: {
      id?: string; nome: string; tipo: DespesaTipo; ordem: number | null; pai?: DespesaCategoria;
    }) => {
      const n = nome.trim();
      if (!n) throw new Error('Informe o nome da subcategoria.');
      let error;
      if (id) {
        ({ error } = await supabase.from('despesas_categorias').update({ nome: n, tipo, ordem }).eq('id', id));
      } else {
        if (!pai) throw new Error('Categoria central não informada.');
        const { data: irmas, error: e } = await supabase.from('despesas_categorias')
          .select('codigo, ordem').eq('categoria_pai_id', pai.id);
        if (e) throw e;
        const maxSeq = Math.max(0, ...(irmas ?? []).map((r) => Number((r.codigo ?? '').split('.')[1]) || 0));
        const maxOrdem = Math.max(0, ...(irmas ?? []).map((r) => r.ordem ?? 0));
        ({ error } = await supabase.from('despesas_categorias').insert({
          nome: n, tipo, nivel: 'sub', categoria_pai_id: pai.id,
          codigo: `${pai.codigo}.${maxSeq + 1}`, ordem: ordem ?? maxOrdem + 1,
        }));
      }
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma categoria com esse nome.');
        throw error;
      }
    },
    onSuccess: inval,
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('despesas_categorias').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { salvarSub, alternarAtivo };
}

export function useFornecedores() {
  return useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fornecedores').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });
}

export function useFornecedorMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['fornecedores'] });

  const salvar = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FornecedorInput }) => {
      if (!input.nome.trim()) throw new Error('Informe o nome do fornecedor.');
      const payload = { ...input, nome: input.nome.trim() };
      const { error } = id
        ? await supabase.from('fornecedores').update(payload).eq('id', id)
        : await supabase.from('fornecedores').insert(payload);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('fornecedores').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { salvar, alternarAtivo };
}
