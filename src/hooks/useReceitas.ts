import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Receita, ReceitaCategoria, ReceitaInput } from '@/types/receitas';

/** Busca receitas com data_competencia entre inicio e fim (inclusive), paginando em lotes de 1000. */
async function fetchReceitas(inicio: string, fim: string): Promise<Receita[]> {
  const out: Receita[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('receitas')
      .select('*')
      .gte('data_competencia', inicio)
      .lte('data_competencia', fim)
      .order('data_competencia', { ascending: false })
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Receita[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useReceitasPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['receitas', inicio, fim],
    queryFn: () => fetchReceitas(inicio, fim),
    placeholderData: keepPreviousData,
  });
}

export function useCategoriasReceita(apenasAtivas = false) {
  return useQuery({
    queryKey: ['receitas-categorias', apenasAtivas],
    queryFn: async () => {
      let q = supabase.from('receitas_categorias').select('*').order('tipo').order('nome');
      if (apenasAtivas) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReceitaCategoria[];
    },
  });
}

/** Contagem de receitas por categoria (para bloquear exclusão de categorias em uso). */
export function useUsoCategoriasReceita() {
  return useQuery({
    queryKey: ['receitas-categorias-uso'],
    queryFn: async () => {
      const map: Record<string, number> = {};
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('receitas').select('categoria_id').order('id').range(from, from + 999);
        if (error) throw error;
        (data ?? []).forEach((r) => { if (r.categoria_id) map[r.categoria_id] = (map[r.categoria_id] ?? 0) + 1; });
        if (!data || data.length < 1000) break;
      }
      return map;
    },
  });
}

export function useReceitaMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['receitas'] });
    qc.invalidateQueries({ queryKey: ['receitas-categorias-uso'] });
  };

  const salvar = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ReceitaInput }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      if (id) {
        const { error } = await supabase.from('receitas').update({ ...input, updated_by: uid }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('receitas').insert({ ...input, origem: 'manual', created_by: uid, updated_by: uid });
        if (error) throw error;
      }
    },
    onSuccess: inval,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receitas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const alternarConciliado = useMutation({
    mutationFn: async ({ id, conciliado }: { id: string; conciliado: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('receitas')
        .update({ conciliado, updated_by: u.user?.id ?? null }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, conciliado }) => {
      await qc.cancelQueries({ queryKey: ['receitas'] });
      const snaps = qc.getQueriesData<Receita[]>({ queryKey: ['receitas'] });
      snaps.forEach(([k, v]) => v && qc.setQueryData(k, v.map((d) => (d.id === id ? { ...d, conciliado } : d))));
      return { snaps };
    },
    onError: (_e, _v, ctx) => ctx?.snaps.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['receitas'] }),
  });

  return { salvar, excluir, alternarConciliado };
}

export function useCategoriaReceitaMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['receitas-categorias'] });

  const salvar = useMutation({
    mutationFn: async ({ id, nome, tipo }: { id?: string; nome: string; tipo: string }) => {
      const n = nome.trim();
      if (!n) throw new Error('Informe o nome da categoria.');
      const { error } = id
        ? await supabase.from('receitas_categorias').update({ nome: n, tipo }).eq('id', id)
        : await supabase.from('receitas_categorias').insert({ nome: n, tipo });
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma categoria com esse nome.');
        throw error;
      }
    },
    onSuccess: inval,
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('receitas_categorias').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { count, error: cErr } = await supabase
        .from('receitas').select('id', { count: 'exact', head: true }).eq('categoria_id', id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error('Categoria possui receitas vinculadas — desative em vez de excluir.');
      const { error } = await supabase.from('receitas_categorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { salvar, alternarAtivo, excluir };
}
