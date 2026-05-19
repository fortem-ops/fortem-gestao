import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardCheck, Eye, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssessmentViewerDialog } from "./assessment/AssessmentViewerDialog";
import { fetchLastFuncionalDate, severityForLastFuncional } from "@/lib/avaliacaoFuncional";

export function StudentAssessments({ student }: { student: Tables<"alunos"> }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Tables<"avaliacoes"> | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: lastFuncional } = useQuery({
    queryKey: ["last_funcional_aluno", student.id],
    queryFn: () => fetchLastFuncionalDate(student.id),
  });

  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes-aluno", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openViewer = (a: Tables<"avaliacoes">) => {
    setSelected(a);
    setViewerOpen(true);
  };

  const sev = severityForLastFuncional(lastFuncional ?? null);

  return (
    <div className="space-y-4 mt-4">
      <div className="glass-card rounded-lg p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Última Avaliação Funcional</p>
            <p className="text-base font-semibold text-foreground">
              {lastFuncional
                ? format(lastFuncional, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : "Nunca realizada"}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`${sev.className} text-xs shrink-0`}>{sev.label}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Histórico de Avaliações</h3>
        <Button onClick={() => navigate(`/avaliacoes?aluno=${student.id}&new=1`)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Realizar Avaliação
        </Button>
      </div>


      {(!avaliacoes || avaliacoes.length === 0) ? (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhuma avaliação realizada para este aluno.
        </div>
      ) : (
        <div className="space-y-2">
          {avaliacoes.map((a) => (
            <button
              key={a.id}
              onClick={() => openViewer(a)}
              className="glass-card rounded-lg p-4 flex items-start gap-3 w-full text-left hover:bg-secondary/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground capitalize">{a.tipo.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(a.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {a.observacoes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.observacoes}</p>
                )}
              </div>
              <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
            </button>
          ))}
        </div>
      )}

      <AssessmentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        avaliacao={selected}
        student={student}
      />
    </div>
  );
}
