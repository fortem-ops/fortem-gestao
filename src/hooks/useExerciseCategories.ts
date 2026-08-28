import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Visão achatada (compatibilidade): Grupo -> todas as subcategorias de todas as categorias */
export interface ExerciseCategory {
  name: string;
  subcategories: string[];
}

/** Visão em árvore de 3 níveis: Grupo > Categoria > Subcategoria */
export interface ExerciseCategoriaNode {
  nome: string;
  subcategorias: string[];
}
export interface ExerciseGrupoNode {
  nome: string;
  categorias: ExerciseCategoriaNode[];
}

interface CategoriaRow {
  id: string;
  grupo: string;
  categoria: string;
  subcategoria: string;
  ordem_grupo: number;
  ordem_categoria: number;
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
        .select("id, grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub")
        .order("ordem_grupo", { ascending: true })
        .order("ordem_categoria", { ascending: true })
        .order("ordem_sub", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CategoriaRow[];
    },
  });

  /** Árvore de 3 níveis */
  const tree = useMemo<ExerciseGrupoNode[]>(() => {
    const grupos = new Map<
      string,
      {
        ordem: number;
        cats: Map<string, { ordem: number; subs: { sub: string; ordem: number }[] }>;
      }
    >();
    for (const r of rows) {
      const cat = r.categoria || r.grupo;
      const g = grupos.get(r.grupo) ?? { ordem: r.ordem_grupo, cats: new Map() };
      g.ordem = Math.min(g.ordem, r.ordem_grupo);
      const c = g.cats.get(cat) ?? { ordem: r.ordem_categoria, subs: [] };
      c.ordem = Math.min(c.ordem, r.ordem_categoria);
      c.subs.push({ sub: r.subcategoria, ordem: r.ordem_sub });
      g.cats.set(cat, c);
      grupos.set(r.grupo, g);
    }
    return Array.from(grupos.entries())
      .sort((a, b) => a[1].ordem - b[1].ordem || a[0].localeCompare(b[0]))
      .map(([nome, g]) => ({
        nome,
        categorias: Array.from(g.cats.entries())
          .sort((a, b) => a[1].ordem - b[1].ordem || a[0].localeCompare(b[0]))
          .map(([cnome, c]) => ({
            nome: cnome,
            subcategorias: c.subs
              .sort((a, b) => a.ordem - b.ordem || a.sub.localeCompare(b.sub))
              .map((s) => s.sub),
          })),
      }));
  }, [rows]);

  /** Compatibilidade: grupo -> subcategorias (achatado de todas as categorias) */
  const categories = useMemo<ExerciseCategory[]>(
    () =>
      tree.map((g) => ({
        name: g.nome,
        subcategories: Array.from(
          new Set(g.categorias.flatMap((c) => c.subcategorias)),
        ),
      })),
    [tree],
  );

  const grupoSubcategorias = useMemo<Record<string, string[]>>(() => {
    const r: Record<string, string[]> = {};
    for (const c of categories) r[c.name] = c.subcategories;
    return r;
  }, [categories]);

  /** Descobre a categoria (nível 2) a que pertence um par grupo/subcategoria */
  const resolverCategoria = (grupo: string, sub?: string | null): string => {
    const g = tree.find((x) => x.nome === grupo);
    if (!g) return grupo;
    if (sub) {
      const c = g.categorias.find((x) => x.subcategorias.includes(sub));
      if (c) return c.nome;
    }
    return g.categorias[0]?.nome ?? grupo;
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QKEY });
    qc.invalidateQueries({ queryKey: ["exercicios-personalizados"] });
  };

  // ---------------------------------------------------------------- criar

  const addGrupo = useMutation({
    mutationFn: async (grupo: string) => {
      const maxOrdem = rows.reduce((m, r) => Math.max(m, r.ordem_grupo), 0);
      const { error } = await supabase.from("exercicio_categorias" as any).insert({
        grupo,
        categoria: grupo,
        subcategoria: "Geral",
        ordem_grupo: maxOrdem + 10,
        ordem_categoria: 10,
        ordem_sub: 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addCategoria = useMutation({
    mutationFn: async ({ grupo, categoria }: { grupo: string; categoria: string }) => {
      const groupRows = rows.filter((r) => r.grupo === grupo);
      const ordemGrupo =
        groupRows[0]?.ordem_grupo ?? rows.reduce((m, r) => Math.max(m, r.ordem_grupo), 0) + 10;
      const ordemCat = groupRows.reduce((m, r) => Math.max(m, r.ordem_categoria), 0) + 10;
      const { error } = await supabase.from("exercicio_categorias" as any).insert({
        grupo,
        categoria,
        subcategoria: "Geral",
        ordem_grupo: ordemGrupo,
        ordem_categoria: ordemCat,
        ordem_sub: 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addSub = useMutation({
    mutationFn: async ({
      grupo,
      categoria,
      subcategoria,
    }: {
      grupo: string;
      categoria?: string;
      subcategoria: string;
    }) => {
      const cat = categoria ?? resolverCategoria(grupo);
      const groupRows = rows.filter((r) => r.grupo === grupo);
      const catRows = groupRows.filter((r) => r.categoria === cat);
      const ordemGrupo =
        groupRows[0]?.ordem_grupo ?? rows.reduce((m, r) => Math.max(m, r.ordem_grupo), 0) + 10;
      const ordemCat =
        catRows[0]?.ordem_categoria ??
        groupRows.reduce((m, r) => Math.max(m, r.ordem_categoria), 0) + 10;
      const ordemSub = catRows.reduce((m, r) => Math.max(m, r.ordem_sub), 0) + 10;
      const { error } = await supabase.from("exercicio_categorias" as any).insert({
        grupo,
        categoria: cat,
        subcategoria,
        ordem_grupo: ordemGrupo,
        ordem_categoria: ordemCat,
        ordem_sub: ordemSub,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // -------------------------------------------------------------- renomear

  const renomear = useMutation({
    mutationFn: async ({
      grupo,
      categoria,
      subcategoria,
      novoNome,
    }: {
      grupo: string;
      categoria?: string | null;
      subcategoria?: string | null;
      novoNome: string;
    }) => {
      const { error } = await supabase.rpc("fn_renomear_nivel_exercicio" as any, {
        p_grupo: grupo,
        p_categoria: categoria ?? null,
        p_subcategoria: subcategoria ?? null,
        p_novo_nome: novoNome,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameGrupo = useMutation({
    mutationFn: async ({ oldGrupo, newGrupo }: { oldGrupo: string; newGrupo: string }) => {
      const { error } = await supabase.rpc("fn_renomear_nivel_exercicio" as any, {
        p_grupo: oldGrupo,
        p_categoria: null,
        p_subcategoria: null,
        p_novo_nome: newGrupo,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // -------------------------------------------------------------- contagem

  const countExercicios = (grupo: string, categoria?: string | null, sub?: string | null) => {
    const obj: Record<string, string> = { grupo };
    if (categoria) obj.categoria = categoria;
    if (sub) obj.subcategoria = sub;
    return supabase
      .from("exercicios_personalizados")
      .select("id", { count: "exact", head: true })
      .filter("grupos", "cs", JSON.stringify([obj]));
  };

  const contarExercicios = async (
    grupo: string,
    categoria?: string | null,
    sub?: string | null,
  ) => {
    const { count, error } = await countExercicios(grupo, categoria, sub);
    if (error) throw error;
    return count ?? 0;
  };

  const contarPorSubcategoria = async (
    grupo: string,
    categoria?: string | null,
  ): Promise<{ sub: string; total: number }[]> => {
    const { data, error } = await supabase
      .from("exercicios_personalizados")
      .select("grupos")
      .filter("grupos", "cs", JSON.stringify([{ grupo }]));
    if (error) throw error;
    const map = new Map<string, number>();
    for (const row of (data || []) as { grupos: unknown }[]) {
      const gs = (row.grupos as { grupo: string; categoria?: string; subcategoria?: string }[]) || [];
      for (const g of gs) {
        if (g.grupo !== grupo) continue;
        if (categoria && (g.categoria || g.grupo) !== categoria) continue;
        const key = g.subcategoria || "(sem subcategoria)";
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([sub, total]) => ({ sub, total }))
      .sort((a, b) => a.sub.localeCompare(b.sub));
  };

  // -------------------------------------------------------------- excluir

  const deleteGrupo = useMutation({
    mutationFn: async (grupo: string) => {
      const { count, error: cErr } = await countExercicios(grupo);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Existem ${count} exercício(s) nesse grupo. Mova-os ou exclua-os antes.`);
      }
      const { error } = await supabase.from("exercicio_categorias" as any).delete().eq("grupo", grupo);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteCategoria = useMutation({
    mutationFn: async ({ grupo, categoria }: { grupo: string; categoria: string }) => {
      const { count, error: cErr } = await countExercicios(grupo, categoria);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Existem ${count} exercício(s) nessa categoria. Mova-os ou exclua-os antes.`,
        );
      }
      const { error } = await supabase
        .from("exercicio_categorias" as any)
        .delete()
        .eq("grupo", grupo)
        .eq("categoria", categoria);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSub = useMutation({
    mutationFn: async ({
      grupo,
      categoria,
      subcategoria,
    }: {
      grupo: string;
      categoria?: string;
      subcategoria: string;
    }) => {
      const cat = categoria ?? resolverCategoria(grupo, subcategoria);
      const { count, error: cErr } = await countExercicios(grupo, cat, subcategoria);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Existem ${count} exercício(s) nessa subcategoria. Mova-os ou exclua-os antes.`,
        );
      }
      const { error } = await supabase
        .from("exercicio_categorias" as any)
        .delete()
        .eq("grupo", grupo)
        .eq("categoria", cat)
        .eq("subcategoria", subcategoria);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ---------------------------------------------------------------- mover

  /** Grupo inteiro vira CATEGORIA dentro de outro grupo (nada é apagado) */
  const moverGrupoComoCategoria = useMutation({
    mutationFn: async ({ grupoOrigem, grupoDestino }: { grupoOrigem: string; grupoDestino: string }) => {
      const { data, error } = await supabase.rpc("fn_mover_grupo_como_categoria" as any, {
        p_grupo_origem: grupoOrigem,
        p_grupo_destino: grupoDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  /** Categoria muda de grupo levando subcategorias e exercícios */
  const moverCategoriaParaGrupo = useMutation({
    mutationFn: async ({
      grupoOrigem,
      categoria,
      grupoDestino,
    }: {
      grupoOrigem: string;
      categoria: string;
      grupoDestino: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_mover_categoria_para_grupo" as any, {
        p_grupo_origem: grupoOrigem,
        p_categoria: categoria,
        p_grupo_destino: grupoDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  /** Subcategoria muda de categoria levando os exercícios */
  const moverSubParaCategoria = useMutation({
    mutationFn: async ({
      grupoOrigem,
      categoriaOrigem,
      sub,
      grupoDestino,
      categoriaDestino,
    }: {
      grupoOrigem: string;
      categoriaOrigem: string;
      sub: string;
      grupoDestino: string;
      categoriaDestino: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_mover_sub_para_categoria" as any, {
        p_grupo_origem: grupoOrigem,
        p_categoria_origem: categoriaOrigem,
        p_sub: sub,
        p_grupo_destino: grupoDestino,
        p_categoria_destino: categoriaDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  const migrar = useMutation({
    mutationFn: async ({
      grupoOrigem,
      categoriaOrigem,
      subOrigem,
      grupoDestino,
      categoriaDestino,
      subDestino,
    }: {
      grupoOrigem: string;
      categoriaOrigem: string | null;
      subOrigem: string | null;
      grupoDestino: string;
      categoriaDestino: string;
      subDestino: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_migrar_exercicio_categoria" as any, {
        p_grupo_origem: grupoOrigem,
        p_categoria_origem: categoriaOrigem,
        p_sub_origem: subOrigem,
        p_grupo_destino: grupoDestino,
        p_categoria_destino: categoriaDestino,
        p_sub_destino: subDestino,
      } as any);
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------ reordenar

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

  const reorderCategorias = useMutation({
    mutationFn: async ({ grupo, novaOrdem }: { grupo: string; novaOrdem: string[] }) => {
      for (let i = 0; i < novaOrdem.length; i++) {
        const { error } = await supabase
          .from("exercicio_categorias" as any)
          .update({ ordem_categoria: (i + 1) * 10 } as any)
          .eq("grupo", grupo)
          .eq("categoria", novaOrdem[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const reorderSubs = useMutation({
    mutationFn: async ({
      grupo,
      categoria,
      novaOrdem,
    }: {
      grupo: string;
      categoria: string;
      novaOrdem: string[];
    }) => {
      for (let i = 0; i < novaOrdem.length; i++) {
        const { error } = await supabase
          .from("exercicio_categorias" as any)
          .update({ ordem_sub: (i + 1) * 10 } as any)
          .eq("grupo", grupo)
          .eq("categoria", categoria)
          .eq("subcategoria", novaOrdem[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return {
    isLoading,
    rows,
    tree,
    categories,
    grupoSubcategorias,
    resolverCategoria,
    addGrupo,
    addCategoria,
    addSub,
    renomear,
    renameGrupo,
    deleteGrupo,
    deleteCategoria,
    deleteSub,
    migrar,
    moverGrupoComoCategoria,
    moverCategoriaParaGrupo,
    moverSubParaCategoria,
    contarPorSubcategoria,
    reorderGrupos,
    reorderCategorias,
    reorderSubs,
    contarExercicios,
  };
}
