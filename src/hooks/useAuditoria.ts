import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";

export type AuditoriaSeveridade = "critico" | "atencao" | "info";
export type AuditoriaStatus = "aberto" | "resolvido" | "ignorado";

export interface AuditoriaItem {
  id: string;
  categoria: string;
  subtipo: string;
  severidade: AuditoriaSeveridade;
  descricao: string;
  aluno_id: string | null;
  registros_afetados: Record<string, unknown> | null;
  status: AuditoriaStatus;
  nota_resolucao: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  detectado_em: string;
  aluno_nome?: string | null;
}

export interface AuditoriaFiltros {
  categoria?: string;
  severidade?: string;
  status?: string;
}

export function useAuditoriaItens(filtros: AuditoriaFiltros) {
  return useQuery({
    queryKey: ["auditoria-itens", filtros],
    queryFn: async (): Promise<AuditoriaItem[]> => {
      let q = supabase
        .from("auditoria_inconsistencias")
        .select("*")
        .order("detectado_em", { ascending: false })
        .limit(500);

      if (filtros.categoria && filtros.categoria !== "todas") q = q.eq("categoria", filtros.categoria);
      if (filtros.severidade && filtros.severidade !== "todas") q = q.eq("severidade", filtros.severidade);
      if (filtros.status && filtros.status !== "todos") q = q.eq("status", filtros.status);

      const { data, error } = await q;
      if (error) throw error;

      const itens = (data || []) as unknown as AuditoriaItem[];
      const alunoIds = [...new Set(itens.map((i) => i.aluno_id).filter(Boolean))] as string[];
      if (alunoIds.length) {
        const { data: alunos } = await supabase.from("alunos").select("id, nome").in("id", alunoIds);
        const map = new Map((alunos || []).map((a) => [a.id, a.nome]));
        itens.forEach((i) => {
          i.aluno_nome = i.aluno_id ? map.get(i.aluno_id) ?? null : null;
        });
      }
      return itens;
    },
    staleTime: 60_000,
  });
}

export interface AuditoriaResumo {
  abertos: number;
  criticos: number;
  atencao: number;
  porCategoria: { categoria: string; total: number }[];
}

export function useAuditoriaResumo(enabled = true) {
  return useQuery({
    queryKey: ["auditoria-resumo"],
    queryFn: async (): Promise<AuditoriaResumo> => {
      const { data, error } = await supabase
        .from("auditoria_inconsistencias")
        .select("categoria, severidade")
        .eq("status", "aberto")
        .limit(2000);
      if (error) throw error;

      const rows = (data || []) as { categoria: string; severidade: string }[];
      const cat = new Map<string, number>();
      rows.forEach((r) => cat.set(r.categoria, (cat.get(r.categoria) || 0) + 1));

      return {
        abertos: rows.length,
        criticos: rows.filter((r) => r.severidade === "critico").length,
        atencao: rows.filter((r) => r.severidade === "atencao").length,
        porCategoria: [...cat.entries()]
          .map(([categoria, total]) => ({ categoria, total }))
          .sort((a, b) => b.total - a.total),
      };
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useResolverAuditoria() {
  return useSupabaseMutation<
    void,
    { id: string; status: Exclude<AuditoriaStatus, "aberto">; nota?: string }
  >({
    mutationFn: async ({ id, status, nota }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("auditoria_inconsistencias")
        .update({
          status,
          nota_resolucao: nota?.trim() || null,
          resolvido_por: userData?.user?.id ?? null,
          resolvido_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    successMessage: "Item de auditoria atualizado",
    invalidates: [["auditoria-itens"], ["auditoria-resumo"]],
  });
}
