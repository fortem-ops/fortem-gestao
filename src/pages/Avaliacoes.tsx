import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StudentPicker } from "@/components/student/StudentPicker";
import { AssessmentForm } from "@/components/student/assessment/AssessmentForm";
import { AssessmentViewerDialog } from "@/components/student/assessment/AssessmentViewerDialog";
import type { Tables } from "@/integrations/supabase/types";

type View = "select" | "new";

export default function Avaliacoes() {
  const [searchParams] = useSearchParams();
  const initialAluno = searchParams.get("aluno") || "";
  const autoNew = searchParams.get("new") === "1";

  const [alunoId, setAlunoId] = useState<string>(initialAluno);
  const [view, setView] = useState<View>(autoNew && initialAluno ? "new" : "select");
  const [selectedAval, setSelectedAval] = useState<Tables<"avaliacoes"> | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: aluno } = useQuery({
    queryKey: ["aluno-min-aval", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("id", alunoId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes-global", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (view === "new" && aluno) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("select")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-heading font-bold text-foreground">Nova Avaliação — {aluno.nome}</h1>
        </div>
        <AssessmentForm student={aluno} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Avaliações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um aluno para realizar uma nova avaliação ou consultar o histórico.
        </p>
      </div>

      <div className="glass-card rounded-lg p-6">
        <StudentPicker value={alunoId} onChange={setAlunoId} />
      </div>

      {alunoId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-foreground">Histórico de {aluno?.nome}</h2>
            <Button onClick={() => setView("new")}>
              <Plus className="w-4 h-4 mr-1" /> Nova Avaliação
            </Button>
          </div>

          {(!avaliacoes || avaliacoes.length === 0) ? (
            <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nenhuma avaliação realizada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {avaliacoes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAval(a); setViewerOpen(true); }}
                  className="glass-card rounded-lg p-4 w-full text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">{a.tipo.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(a.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {a.observacoes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.observacoes}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {aluno && (
            <AssessmentViewerDialog
              open={viewerOpen}
              onOpenChange={setViewerOpen}
              avaliacao={selectedAval}
              student={aluno}
            />
          )}
        </>
      )}
    </div>
  );
}
