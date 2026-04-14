import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Plus, Eye, Dumbbell } from "lucide-react";
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from "./workout/workoutTemplates";
import { WorkoutDetail } from "./workout/WorkoutDetail";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type View = "dashboard" | "history" | "newPhaseSelect" | "newWorkout" | "viewWorkout";

export function StudentWorkouts({ student }: { student: Tables<"alunos"> }) {
  const [view, setView] = useState<View>("dashboard");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [selectedTreino, setSelectedTreino] = useState<Tables<"treinos"> | null>(null);

  const { data: treinos, refetch } = useQuery({
    queryKey: ["treinos", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const currentTreino = treinos?.find(t => t.status === "atual");

  if (view === "newWorkout" && selectedTemplate) {
    return (
      <div className="mt-4">
        <WorkoutDetail
          alunoId={student.id}
          templateData={{ aquecimento: selectedTemplate.aquecimento, treinos: selectedTemplate.treinos }}
          fase={selectedTemplate.fase}
          onBack={() => { setView("dashboard"); setSelectedTemplate(null); }}
          onSaved={() => refetch()}
        />
      </div>
    );
  }

  if (view === "viewWorkout" && selectedTreino) {
    return (
      <div className="mt-4">
        <WorkoutDetail
          treino={selectedTreino}
          alunoId={student.id}
          onBack={() => { setView("history"); setSelectedTreino(null); }}
          onSaved={() => refetch()}
        />
      </div>
    );
  }

  if (view === "newPhaseSelect") {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("dashboard")}>
            ← Voltar
          </Button>
          <h3 className="font-heading font-semibold text-foreground">Novo Treino — Selecione a Fase</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

  if (view === "history") {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("dashboard")}>
            ← Voltar
          </Button>
          <h3 className="font-heading font-semibold text-foreground">Histórico de Treinos</h3>
        </div>
        {(!treinos || treinos.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum treino registrado</p>
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
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Treinos</h3>

      {/* Current workout summary */}
      {currentTreino && (
        <div
          className="glass-card rounded-lg p-4 border-primary/30 cursor-pointer hover:border-primary/50 transition-all"
          onClick={() => { setSelectedTreino(currentTreino); setView("viewWorkout"); }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Treino Atual</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
              v{currentTreino.versao}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{currentTreino.descricao}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(currentTreino.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setView("history")}
          className="glass-card rounded-lg p-5 text-left hover:border-primary/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <FolderOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <span className="font-heading font-semibold text-foreground text-sm">Histórico de Treinos</span>
              <p className="text-xs text-muted-foreground">{treinos?.length || 0} treino(s) registrado(s)</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setView("newPhaseSelect")}
          className="glass-card rounded-lg p-5 text-left hover:border-primary/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-heading font-semibold text-foreground text-sm">Novo Treino</span>
              <p className="text-xs text-muted-foreground">Fase 1 · Fase 2 · Fase 3 · Fase 4</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
