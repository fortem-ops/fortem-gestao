import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Plus, Eye, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StudentPicker } from "@/components/student/StudentPicker";
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from "@/components/student/workout/workoutTemplates";
import { WorkoutDetail } from "@/components/student/workout/WorkoutDetail";
import type { Tables } from "@/integrations/supabase/types";

type View = "select" | "phaseSelect" | "newWorkout" | "viewWorkout";

export default function Treinos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAluno = searchParams.get("aluno") || "";
  const autoNew = searchParams.get("new") === "1";

  const [alunoId, setAlunoId] = useState<string>(initialAluno);
  const [view, setView] = useState<View>(autoNew && initialAluno ? "phaseSelect" : "select");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [selectedTreino, setSelectedTreino] = useState<Tables<"treinos"> | null>(null);

  const { data: aluno } = useQuery({
    queryKey: ["aluno-min", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("id, nome").eq("id", alunoId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: treinos, refetch } = useQuery({
    queryKey: ["treinos-global", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSelectAluno = (id: string) => {
    setAlunoId(id);
    setView("select");
  };

  if (view === "newWorkout" && selectedTemplate && alunoId) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground">Prescrever Treino — {aluno?.nome}</h1>
        </div>
        <WorkoutDetail
          alunoId={alunoId}
          templateData={{ aquecimento: selectedTemplate.aquecimento, treinos: selectedTemplate.treinos }}
          fase={selectedTemplate.fase}
          onBack={() => { setView("select"); setSelectedTemplate(null); }}
          onSaved={() => refetch()}
        />
      </div>
    );
  }

  if (view === "viewWorkout" && selectedTreino) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-heading font-bold text-foreground">Treino — {aluno?.nome}</h1>
        <WorkoutDetail
          treino={selectedTreino}
          alunoId={alunoId}
          onBack={() => { setView("select"); setSelectedTreino(null); }}
          onSaved={() => refetch()}
        />
      </div>
    );
  }

  if (view === "phaseSelect") {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("select")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-heading font-bold text-foreground">Selecione a Fase — {aluno?.nome}</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {WORKOUT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.fase}
              onClick={() => { setSelectedTemplate(tmpl); setView("newWorkout"); }}
              className="glass-card rounded-lg p-6 text-center hover:border-primary/50 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <span className="font-heading font-bold text-foreground text-lg">{tmpl.fase}</span>
              <p className="text-xs text-muted-foreground mt-1">{tmpl.frequencia}/semana · {tmpl.treinos.length} treinos</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Prescrição de Treinos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um aluno para prescrever um novo treino ou consultar o histórico.
        </p>
      </div>

      <div className="glass-card rounded-lg p-6">
        <StudentPicker value={alunoId} onChange={handleSelectAluno} />
      </div>

      {alunoId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-foreground">Histórico de {aluno?.nome}</h2>
            <Button onClick={() => setView("phaseSelect")}>
              <Plus className="w-4 h-4 mr-1" /> Novo Treino
            </Button>
          </div>

          {(!treinos || treinos.length === 0) ? (
            <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nenhum treino prescrito ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {treinos.map(t => (
                <div
                  key={t.id}
                  className="glass-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => { setSelectedTreino(t); setView("viewWorkout"); }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{t.descricao}</span>
                      {t.status === "atual" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      v{t.versao} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
