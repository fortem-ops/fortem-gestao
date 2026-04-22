import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, MessageCircle, Settings2, ShieldAlert } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { stageColor, waMeLink, QUICK_MESSAGES } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { PipelineMetadataDialog } from "./PipelineMetadataDialog";
import { PipelineHistoryTimeline } from "./PipelineHistoryTimeline";

interface Props {
  student: Tables<"alunos">;
  onChanged?: () => void;
}

export function StudentPipelinePanel({ student, onChanged }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [metaOpen, setMetaOpen] = useState(false);

  const { data: stages = [] } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id,name,position,color")
        .eq("is_active", true)
        .order("position");
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const currentStage = stages.find((s: any) => s.id === student.current_pipeline_stage_id);
  const colors = currentStage ? stageColor(currentStage.color) : stageColor("zinc");

  async function moveTo(stageName: string) {
    const { error } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: student.id,
      _to_stage_name: stageName,
      _source: "manual",
      _notes: null,
      _moved_by: user?.id ?? null,
    } as any);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(`Movido para ${stageName}`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-history", student.id] });
      queryClient.invalidateQueries({ queryKey: ["aluno", student.id] });
      onChanged?.();
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Etapa atual</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setMetaOpen(true)} className="gap-2">
            <Settings2 className="w-3.5 h-3.5" /> Dados comerciais
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("gap-2 h-auto py-2", colors.bg, colors.border, colors.text)}>
                <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
                {currentStage?.name || "Sem etapa"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[400px] overflow-y-auto">
              {stages.map((s: any) => (
                <DropdownMenuItem key={s.id} onClick={() => moveTo(s.name)}>
                  <span className={cn("w-2 h-2 rounded-full mr-2", stageColor(s.color).dot)} />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* WhatsApp quick actions */}
          {student.telefone && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> Mensagens rápidas (WhatsApp)
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_MESSAGES.map((q) => {
                  const link = waMeLink(student.telefone, q.build(student.nome.split(" ")[0]));
                  if (!link) return null;
                  return (
                    <Button key={q.key} asChild variant="outline" size="sm" className="text-xs h-8">
                      <a href={link} target="_blank" rel="noopener noreferrer">{q.label}</a>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          {!student.telefone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Cadastre um telefone para enviar mensagens via WhatsApp.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Histórico de movimentações</CardTitle></CardHeader>
        <CardContent>
          <PipelineHistoryTimeline alunoId={student.id} />
        </CardContent>
      </Card>

      <PipelineMetadataDialog alunoId={student.id} open={metaOpen} onOpenChange={setMetaOpen} />
    </div>
  );
}
