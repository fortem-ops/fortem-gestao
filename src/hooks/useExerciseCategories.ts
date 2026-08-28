import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExerciseCategory {
  name: string;
  subcategories: string[];
}

interface CategoriaRow {
  id: string;
  grupo: string;
  subcategoria: string;
  ordem_grupo: number;
  ordem_sub: number;
}

const QKEY = ["exercicio-categorias"] as const;

export function useExerciseCategories() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: QKEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercicio_categorias" as any)
        .select("id, grupo, subcategoria, ordem_grupo, ordem_sub")
        .order("ordem_grupo", { ascending: true })
        .order("ordem_sub", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CategoriaRow[];
    },
  });

  const categories = useMemo<ExerciseCategory[]>(() => {
    const map = new Map<string, { ordem: number; subs: { sub: string; ordem: number }[] }>();
    for (const r of rows) {
      const cur = map.get(r.grupo) ?? { ordem: r.ordem_grupo, subs: [] };
      cur.ordem = Math.min(cur.ordem, r.ordem_grupo);
      cur.subs.push({ sub: r.subcategoria, ordem: r.ordem_sub });
      map.set(r.grupo, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].ordem - b[1].ordem || a[0].localeCompare(b[0]))
      .map(([name, v]) => ({
        name,
        subcategories: v.subs.sort((a, b) => a.ordem - b.ordem || a.sub.localeCompare(b.sub)).map((s) => s.sub),
      }));
  }, [rows]);

  const grupoSubcategorias = useMemo<Record<string, string[]>>(() => {
    const r: Record<string, string[]> = {};
    for (const c of categories) r[c.name] = c.subcategories;
    return r;
  }, [categories]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QKEY });
    qc.invalidateQueries({ queryKey: ["exercicios-personalizados"] });
  };

  const addGrupo = useMutation({
    mutationFn: async (grupo: string) => {
      const maxOrdem = rows.reduce((m, r) => Math.max(m, r.ordem_grupo), 0);
      // Insere uma "subcategoria placeholder" nada — não dá. Em vez disso, criamos a primeira sub junto.
      // Convenção: criamos uma sub padrão "Geral" para que o grupo apareça.
      const { error } = await supabase.from("exercicio_categorias" as any).insert({
        grupo,
        subcategoria: "Geral",
        ordem_grupo: maxOrdem + 10,
        ordem_sub: 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addSub = useMutation({
    mutationFn: async ({ grupo, subcategoria }: { grupo: string; subcategoria: string }) => {
      const groupRows = rows.filter((r) => r.grupo === grupo);
      const ordemGrupo = groupRows[0]?.ordem_grupo ?? rows.reduce((m, r) => Math.max(m, r.ordem_grupo), 0) + 10;
      const ordemSub = groupRows.reduce((m, r) => Math.max(m, r.ordem_sub), 0) + 10;
      const { error } = await supabase.from("exercicio_categorias" as any).insert({
        grupo,
        subcategoria,
        ordem_grupo: ordemGrupo,
        ordem_sub: ordemSub,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameGrupo = useMutation({
    mutationFn: async ({ oldGrupo, newGrupo }: { oldGrupo: string; newGrupo: string }) => {
      const { error } = await supabase.rpc("rename_exercicio_categoria" as any, {
        p_old_grupo: oldGrupo,
        p_new_grupo: newGrupo,
        p_old_sub: null,
        p_new_sub: null,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameSub = useMutation({
    mutationFn: async ({ grupo, oldSub, newSub }: { grupo: string; oldSub: string; newSub: string }) => {
      const { error } = await supabase.rpc("rename_exercicio_categoria" as any, {
        p_old_grupo: grupo,
        p_new_grupo: grupo,
        p_old_sub: oldSub,
        p_new_sub: newSub,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const countExerciciosNoGrupo = (grupo: string, sub?: string) => {
    const filterValue = JSON.stringify(
      sub ? [{ grupo, subcategoria: sub }] : [{ grupo }],
    );
    return supabase
      .from("exercicios_personalizados")
      .select("id", { count: "exact", head: true })
      .filter("grupos", "cs", filterValue);
  };

  const deleteGrupo = useMutation({
    mutationFn: async (grupo: string) => {
      const { count, error: cErr } = await countExerciciosNoGrupo(grupo);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Existem ${count} exercício(s) nesse grupo. Mova-os ou exclua-os antes.`);
      }
      const { error } = await supabase.from("exercicio_categorias" as any).delete().eq("grupo", grupo);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSub = useMutation({
    mutationFn: async ({ grupo, subcategoria }: { grupo: string; subcategoria: string }) => {
      const { count, error: cErr } = await countExerciciosNoGrupo(grupo, subcategoria);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Existem ${count} exercício(s) nessa subcategoria. Mova-os ou exclua-os antes.`);
      }
      const { error } = await supabase
        .from("exercicio_categorias" as any)
        .delete()
        .eq("grupo", grupo)
        .eq("subcategoria", subcategoria);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const migrar = useMutation({
    mutationFn: async ({
      grupoOrigem,
      subOrigem,
      grupoDestino,
      subDestino,
    }: {
      grupoOrigem: string;
      subOrigem: string | null;
      grupoDestino: string;
      subDestino: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_migrar_exercicio_categoria" as any, {
        p_grupo_origem: grupoOrigem,
        p_sub_origem: subOrigem,
        p_grupo_destino: grupoDestino,
        p_sub_destino: subDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  // Migra o grupo inteiro para outro grupo mantendo a subcategoria de cada exercício
  const migrarGrupoPreservandoSubs = useMutation({
    mutationFn: async ({ grupoOrigem, grupoDestino }: { grupoOrigem: string; grupoDestino: string }) => {
      const { data, error } = await supabase.rpc("fn_migrar_grupo_preservando_subs" as any, {
        p_grupo_origem: grupoOrigem,
        p_grupo_destino: grupoDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  // Move a "pasta" inteira (grupo) para dentro de outro grupo: as subcategorias
  // viram subcategorias do destino (mesmo nome) e o grupo de origem deixa de existir.
  const moverGrupoParaGrupo = useMutation({
    mutationFn: async ({ grupoOrigem, grupoDestino }: { grupoOrigem: string; grupoDestino: string }) => {
      const { data, error } = await supabase.rpc("fn_mover_grupo_para_grupo" as any, {
        p_grupo_origem: grupoOrigem,
        p_grupo_destino: grupoDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  // Move uma subcategoria (com seus exercícios) para outro grupo
  const moverSubParaGrupo = useMutation({
    mutationFn: async ({
      grupoOrigem,
      sub,
      grupoDestino,
    }: {
      grupoOrigem: string;
      sub: string;
      grupoDestino: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_mover_sub_para_grupo" as any, {
        p_grupo_origem: grupoOrigem,
        p_sub: sub,
        p_grupo_destino: grupoDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  // Contagem de exercícios por subcategoria dentro de um grupo (para prévia)
  const contarPorSubcategoria = async (grupo: string): Promise<{ sub: string; total: number }[]> => {
    const { data, error } = await supabase
      .from("exercicios_personalizados")
      .select("grupos")
      .filter("grupos", "cs", JSON.stringify([{ grupo }]));
    if (error) throw error;
    const map = new Map<string, number>();
    for (const row of (data || []) as { grupos: unknown }[]) {
      const gs = (row.grupos as { grupo: string; subcategoria?: string }[]) || [];
      for (const g of gs) {
        if (g.grupo !== grupo) continue;
        const key = g.subcategoria || "(sem subcategoria)";
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([sub, total]) => ({ sub, total }))
      .sort((a, b) => a.sub.localeCompare(b.sub));
  };


  // Reordena grupos: aplica ordem_grupo em lote conforme a nova sequência
  const reorderGrupos = useMutation({
    mutationFn: async (novaOrdem: string[]) => {
      for (let i = 0; i < novaOrdem.length; i++) {
        const { error } = await supabase
          .from("exercicio_categorias" as any)
          .update({ ordem_grupo: (i + 1) * 10 } as any)
          .eq("grupo", novaOrdem[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  // Reordena subcategorias dentro de um grupo
  const reorderSubs = useMutation({
    mutationFn: async ({ grupo, novaOrdem }: { grupo: string; novaOrdem: string[] }) => {
      for (let i = 0; i < novaOrdem.length; i++) {
        const { error } = await supabase
          .from("exercicio_categorias" as any)
          .update({ ordem_sub: (i + 1) * 10 } as any)
          .eq("grupo", grupo)
          .eq("subcategoria", novaOrdem[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const contarExercicios = async (grupo: string, sub?: string | null) => {
    const { count, error } = await countExerciciosNoGrupo(grupo, sub ?? undefined);
    if (error) throw error;
    return count ?? 0;
  };

  return {
    isLoading,
    rows,
    categories,
    grupoSubcategorias,
    addGrupo,
    addSub,
    renameGrupo,
    renameSub,
    deleteGrupo,
    deleteSub,
    migrar,
    migrarGrupoPreservandoSubs,
    contarPorSubcategoria,
    reorderGrupos,
    reorderSubs,
    contarExercicios,
  };
}

