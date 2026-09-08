import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoriaAceitaVinculo } from "@/components/student/assessment/funcionalV2/shapeMuscleMapping";
import type { ExercicioVinculado } from "@/components/avaliacoes-premium/aquecimentoSugestoes";

interface GrupoSel { grupo: string; categoria?: string; subcategoria: string }

/**
 * Carrega uma vez todos os vínculos exercício ↔ articulação/músculo e os dados
 * básicos dos exercícios de Aquecimento correspondentes (Mobilidade Articular e Liberação Miofascial).
 */
export function useExerciciosPorArticulacao() {
  return useQuery<ExercicioVinculado[]>({
    queryKey: ["exercicios-por-articulacao"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("exercicio_articulacoes")
        .select("exercicio_id, articulacao_key");
      if (error) throw error;
      if (!links || links.length === 0) return [];

      const porExercicio = new Map<string, string[]>();
      for (const l of links) {
        const arr = porExercicio.get(l.exercicio_id) ?? [];
        arr.push(l.articulacao_key);
        porExercicio.set(l.exercicio_id, arr);
      }

      const ids = Array.from(porExercicio.keys());
      const { data: exs, error: exErr } = await supabase
        .from("exercicios_personalizados")
        .select("id, nome, grupos, video_url, video_path")
        .in("id", ids);
      if (exErr) throw exErr;

      const out: ExercicioVinculado[] = [];
      for (const ex of exs ?? []) {
        const grupos = ((ex.grupos as unknown as GrupoSel[]) ?? []);
        const grupoVinculo = grupos.find((g) => categoriaAceitaVinculo(g.categoria));
        if (!grupoVinculo) continue;
        let video = ex.video_url ?? null;
        if (!video && ex.video_path) {
          video = supabase.storage.from("exercicios-videos").getPublicUrl(ex.video_path).data?.publicUrl ?? null;
        }
        out.push({
          id: ex.id,
          nome: ex.nome,
          video_url: video,
          categoria: grupoVinculo.categoria ?? null,
          articulacoes: porExercicio.get(ex.id) ?? [],
        });
      }
      return out;
    },
  });
}
