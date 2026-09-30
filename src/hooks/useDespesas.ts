import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Despesa, DespesaCategoria, DespesaInput, DespesaTipo } from '@/types/despesas';

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

export function useDespesaMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['despesas'] });
    qc.invalidateQueries({ queryKey: ['despesas-categorias-uso'] });
  };

  const salvar = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: DespesaInput }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
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

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('despesas').delete().eq('id', id);
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

  return { salvar, excluir, alternarConciliado };
}

export function useCategoriaMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['despesas-categorias'] });

  const salvar = useMutation({
    mutationFn: async ({ id, nome, tipo }: { id?: string; nome: string; tipo: DespesaTipo }) => {
      const n = nome.trim();
      if (!n) throw new Error('Informe o nome da categoria.');
      const { error } = id
        ? await supabase.from('despesas_categorias').update({ nome: n, tipo }).eq('id', id)
        : await supabase.from('despesas_categorias').insert({ nome: n, tipo });
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

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { count, error: cErr } = await supabase
        .from('despesas').select('id', { count: 'exact', head: true }).eq('categoria_id', id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error('Categoria possui despesas vinculadas — desative em vez de excluir.');
      const { error } = await supabase.from('despesas_categorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { salvar, alternarAtivo, excluir };
}
