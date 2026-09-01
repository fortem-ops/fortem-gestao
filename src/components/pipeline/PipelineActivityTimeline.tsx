import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle, Sparkles, User } from "lucide-react";
import { ATIVIDADE_CONFIG, type TipoAtividade } from "@/lib/pipeline";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_avaliacao: "Auto · Avaliação",
  auto_plano: "Auto · Plano",
  auto_agenda: "Auto · Agenda",
  auto_evasao: "Auto · Evasão",
  auto_recuperacao: "Auto · Recuperação",
};

interface Entry {
  key: string;
  at: string;
  kind: "move" | "task";
  title: React.ReactNode;
  meta: string;
  notes?: string | null;
}

export function PipelineActivityTimeline({ alunoId }: { alunoId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pipeline-atividades-timeline", alunoId],
    queryFn: async (): Promise<Entry[]> => {
      const [{ data: moves }, { data: tarefas }] = await Promise.all([
        supabase
          .from("pipeline_movements")
          .select("id, from_stage_id, to_stage_id, moved_at, notes, source, moved_by_user_id")
          .eq("aluno_id", alunoId)
          .order("moved_at", { ascending: false }),
        supabase
          .from("tarefas")
          .select("id, titulo, descricao, tipo_atividade, updated_at, responsavel_id, status")
          .eq("aluno_id", alunoId)
          .eq("origem", "pipeline")
          .eq("status", "concluida")
          .order("updated_at", { ascending: false }),
      ]);

      const stageIds = Array.from(
        new Set((moves || []).flatMap((m: any) => [m.from_stage_id, m.to_stage_id]).filter(Boolean)),
      );
      const userIds = Array.from(
        new Set([
          ...(moves || []).map((m: any) => m.moved_by_user_id),
          ...(tarefas || []).map((t: any) => t.responsavel_id),
        ].filter(Boolean)),
      ) as string[];

      const [{ data: stages }, { data: profiles }] = await Promise.all([
        stageIds.length
          ? supabase.from("pipeline_stages").select("id,name").in("id", stageIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("user_id,full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const stageMap: Record<string, string> = {};
      (stages || []).forEach((s: any) => { stageMap[s.id] = s.name; });
      const userMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { userMap[p.user_id] = p.full_name; });

      const moveEntries: Entry[] = (moves || []).map((m: any) => ({
        key: `m-${m.id}`,
        at: m.moved_at,
        kind: "move",
        title: (
          <span className="flex items-center gap-2 flex-wrap">
            {m.from_stage_id && <span className="text-muted-foreground">{stageMap[m.from_stage_id]}</span>}
            {m.from_stage_id && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            <span>{stageMap[m.to_stage_id] || "—"}</span>
            <Badge variant="outline" className="text-[10px] gap-1">
              {m.source === "manual" ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {SOURCE_LABELS[m.source] || m.source}
            </Badge>
          </span>
        ),
        meta: `${new Date(m.moved_at).toLocaleString("pt-BR")}${m.moved_by_user_id && userMap[m.moved_by_user_id] ? ` · ${userMap[m.moved_by_user_id]}` : ""}`,
        notes: m.notes,
      }));

      const taskEntries: Entry[] = (tarefas || []).map((t: any) => {
        const cfg = ATIVIDADE_CONFIG[(t.tipo_atividade as TipoAtividade) || "tarefa"];
        return {
          key: `t-${t.id}`,
          at: t.updated_at,
          kind: "task",
          title: (
            <span className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span>{t.titulo}</span>
              <Badge variant="outline" className="text-[10px]">{cfg?.label || "Tarefa"}</Badge>
            </span>
          ),
          meta: `${new Date(t.updated_at).toLocaleString("pt-BR")}${userMap[t.responsavel_id] ? ` · ${userMap[t.responsavel_id]}` : ""}`,
          notes: t.descricao,
        };
      });

      return [...moveEntries, ...taskEntries].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem histórico comercial ainda.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {items.map((it) => (
        <li key={it.key} className="relative">
          <div
            className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${it.kind === "move" ? "bg-primary" : "bg-muted-foreground"}`}
          />
          <div className="rounded-md border border-border bg-card/50 p-3">
            <div className="text-sm font-medium text-foreground">{it.title}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{it.meta}</p>
            {it.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{it.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
