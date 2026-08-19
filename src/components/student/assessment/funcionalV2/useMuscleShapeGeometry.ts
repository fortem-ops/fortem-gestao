import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ShapeOverride = { cx: number; cy: number; scale: number };
export type ShapeOverrideMap = Record<string, ShapeOverride>;

const QK = ["bodymap-shape-overrides"];

export function useMuscleShapeGeometry() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const overridesQuery = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<ShapeOverrideMap> => {
      const { data, error } = await (supabase as any)
        .from("bodymap_shape_overrides")
        .select("shape_key, cx, cy, scale");
      if (error) throw error;
      const map: ShapeOverrideMap = {};
      (data ?? []).forEach((r: any) => {
        map[r.shape_key] = { cx: Number(r.cx), cy: Number(r.cy), scale: Number(r.scale) };
      });
      return map;
    },
    staleTime: 60_000,
  });

  const saveAll = useMutation({
    mutationFn: async (draft: ShapeOverrideMap) => {
      const rows = Object.entries(draft).map(([shape_key, v]) => ({
        shape_key,
        cx: v.cx,
        cy: v.cy,
        scale: v.scale,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length === 0) return;
      const { error } = await (supabase as any)
        .from("bodymap_shape_overrides")
        .upsert(rows, { onConflict: "shape_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const resetAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("bodymap_shape_overrides")
        .delete()
        .neq("shape_key", "__none__");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return { overrides: overridesQuery.data ?? {}, loading: overridesQuery.isLoading, saveAll, resetAll };
}
