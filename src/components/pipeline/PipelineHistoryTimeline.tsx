import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, User } from "lucide-react";

interface Props {
  alunoId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_avaliacao: "Auto · Avaliação",
  auto_plano: "Auto · Plano",
  auto_agenda: "Auto · Agenda",
  auto_evasao: "Auto · Evasão",
  auto_recuperacao: "Auto · Recuperação",
};

export function PipelineHistoryTimeline({ alunoId }: Props) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pipeline-history", alunoId],
    queryFn: async () => {
      const { data: moves, error } = await supabase
        .from("pipeline_movements")
        .select("id, from_stage_id, to_stage_id, moved_at, notes, source, moved_by_user_id")
        .eq("aluno_id", alunoId)
        .order("moved_at", { ascending: false });
      if (error) throw error;

      const stageIds = Array.from(new Set((moves || []).flatMap((m: any) => [m.from_stage_id, m.to_stage_id]).filter(Boolean)));
      const userIds = Array.from(new Set((moves || []).map((m: any) => m.moved_by_user_id).filter(Boolean)));

      const [{ data: stages }, { data: profiles }] = await Promise.all([
        stageIds.length
          ? supabase.from("pipeline_stages").select("id,name,color").in("id", stageIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("user_id,full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const stageMap: Record<string, { name: string; color: string }> = {};
      (stages || []).forEach((s: any) => { stageMap[s.id] = { name: s.name, color: s.color }; });
      const userMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { userMap[p.user_id] = p.full_name; });

      return (moves || []).map((m: any) => ({
        ...m,
        from_name: m.from_stage_id ? stageMap[m.from_stage_id]?.name : null,
        to_name: stageMap[m.to_stage_id]?.name || "—",
        moved_by_name: m.moved_by_user_id ? userMap[m.moved_by_user_id] : null,
      }));
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações no pipeline ainda.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {items.map((m: any) => (
        <li key={m.id} className="relative">
          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
          <div className="rounded-md border border-border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
              {m.from_name && <span className="text-muted-foreground">{m.from_name}</span>}
              {m.from_name && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              <span>{m.to_name}</span>
              <Badge variant="outline" className="text-[10px] gap-1">
                {m.source === "manual" ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {SOURCE_LABELS[m.source] || m.source}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {new Date(m.moved_at).toLocaleString("pt-BR")}
              {m.moved_by_name && ` · ${m.moved_by_name}`}
            </p>
            {m.notes && <p className="text-xs text-muted-foreground mt-1.5">{m.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
