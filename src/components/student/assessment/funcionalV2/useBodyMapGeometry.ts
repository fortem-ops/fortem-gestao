import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RegionId } from "./bodyMapLogic";

export type RegionOverride = { cx: number; cy: number };
export type OverrideMap = Partial<Record<RegionId, RegionOverride>>;

const QK = ["bodymap-region-overrides"];

export function useBodyMapGeometry() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const overridesQuery = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<OverrideMap> => {
      const { data, error } = await (supabase as any)
        .from("bodymap_region_overrides")
        .select("region_id, cx, cy");
      if (error) throw error;
      const map: OverrideMap = {};
      (data ?? []).forEach((r: any) => {
        map[r.region_id as RegionId] = { cx: Number(r.cx), cy: Number(r.cy) };
      });
      return map;
    },
    staleTime: 60_000,
  });

  const isAdminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const saveAll = useMutation({
    mutationFn: async (draft: OverrideMap) => {
      const rows = Object.entries(draft).map(([region_id, v]) => ({
        region_id,
        cx: v!.cx,
        cy: v!.cy,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length === 0) return;
      const { error } = await (supabase as any)
        .from("bodymap_region_overrides")
        .upsert(rows, { onConflict: "region_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const resetAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("bodymap_region_overrides")
        .delete()
        .neq("region_id", "__none__");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return {
    overrides: overridesQuery.data ?? {},
    loading: overridesQuery.isLoading,
    isAdmin: !!isAdminQuery.data,
    saveAll,
    resetAll,
  };
}
