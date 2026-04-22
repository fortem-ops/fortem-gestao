import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, KanbanSquare } from "lucide-react";
import { stageColor } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export function PipelineWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-pipeline-widget"],
    queryFn: async () => {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id,name,color,position")
        .eq("is_active", true)
        .order("position");

      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, current_pipeline_stage_id, created_at");

      const counts: Record<string, number> = {};
      (alunos || []).forEach((a: any) => {
        if (a.current_pipeline_stage_id) {
          counts[a.current_pipeline_stage_id] = (counts[a.current_pipeline_stage_id] || 0) + 1;
        }
      });

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const novosLeads = (alunos || []).filter((a: any) => new Date(a.created_at) >= since).length;

      const riscoStage = (stages || []).find((s: any) => s.name === "Risco de evasão");
      const emRisco = riscoStage ? (counts[riscoStage.id] || 0) : 0;

      return { stages: stages || [], counts, novosLeads, emRisco };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <KanbanSquare className="w-4 h-4" />
          Pipeline Comercial
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-7 gap-1">
          <Link to="/pipeline">Abrir <ArrowRight className="w-3 h-3" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
            <p className="text-[11px] text-blue-300 uppercase tracking-wide">Novos leads (30d)</p>
            <p className="text-2xl font-heading font-bold text-foreground tabular-nums">{data?.novosLeads ?? 0}</p>
          </div>
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
            <p className="text-[11px] text-rose-300 uppercase tracking-wide">Em risco evasão</p>
            <p className="text-2xl font-heading font-bold text-foreground tabular-nums">{data?.emRisco ?? 0}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Por etapa</p>
          {(data?.stages || []).map((s: any) => {
            const c = stageColor(s.color);
            const count = data?.counts[s.id] || 0;
            if (count === 0) return null;
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                <span className="flex-1 truncate text-muted-foreground">{s.name}</span>
                <span className="tabular-nums font-medium text-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
