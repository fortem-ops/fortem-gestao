import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BodyMapShape {
  shape_key: string;
  label: string;
  view: "front" | "back";
  kind: "musculo" | "articulacao";
  points: Array<[number, number]>;
}

const QK = ["bodymap-shapes"];

export function useBodyMapShapes() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<BodyMapShape[]> => {
      const { data, error } = await (supabase as any)
        .from("bodymap_shapes")
        .select("shape_key, label, view, kind, points")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, points: r.points as Array<[number, number]> }));
    },
    staleTime: 30_000,
  });

  const shapesMap = useMemo(() => {
    const m: Record<string, BodyMapShape> = {};
    (query.data ?? []).forEach((s) => { m[s.shape_key] = s; });
    return m;
  }, [query.data]);

  const saveShape = useMutation({
    mutationFn: async (shape: BodyMapShape) => {
      const { error } = await (supabase as any)
        .from("bodymap_shapes")
        .update({
          points: shape.points,
          label: shape.label,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("shape_key", shape.shape_key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const createShape = useMutation({
    mutationFn: async (shape: BodyMapShape) => {
      const { error } = await (supabase as any).from("bodymap_shapes").insert({
        shape_key: shape.shape_key,
        label: shape.label,
        view: shape.view,
        kind: shape.kind,
        points: shape.points,
        updated_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const deleteShape = useMutation({
    mutationFn: async (shape_key: string) => {
      const { error } = await (supabase as any).from("bodymap_shapes").delete().eq("shape_key", shape_key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return { shapes: query.data ?? [], shapesMap, isLoading: query.isLoading, saveShape, createShape, deleteShape };
}
