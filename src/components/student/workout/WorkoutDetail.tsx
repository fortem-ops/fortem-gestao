import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save } from "lucide-react";
import { CATEGORY_LABELS, type WorkoutExercise } from "./workoutTemplates";
import { ExerciseSelector } from "./ExerciseSelector";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

interface WorkoutDetailProps {
  treino?: {
    id: string;
    descricao: string;
    versao: number;
    status: string;
    conteudo: Json | null;
    created_at: string;
  };
  templateData?: WorkoutData;
  fase?: string;
  alunoId: string;
  onBack: () => void;
  onSaved?: () => void;
  readOnly?: boolean;
}

export function WorkoutDetail({ treino, templateData, fase, alunoId, onBack, onSaved, readOnly }: WorkoutDetailProps) {
  const { user } = useAuth();
  const initialData: WorkoutData = treino?.conteudo
    ? (treino.conteudo as unknown as WorkoutData)
    : templateData || { aquecimento: [], treinos: [] };

  const [data, setData] = useState<WorkoutData>(initialData);
  const [descricao, setDescricao] = useState(treino?.descricao || fase || "");
  const [saving, setSaving] = useState(false);

  const updateExercise = (section: "aquecimento" | "treino", treinoIdx: number, exIdx: number, field: string, value: string) => {
    setData(prev => {
      const next = structuredClone(prev);
      if (section === "aquecimento") {
        (next.aquecimento[exIdx] as unknown as Record<string, unknown>)[field] = value;
      } else {
        (next.treinos[treinoIdx].exercicios[exIdx] as unknown as Record<string, unknown>)[field] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (treino) {
        const { error } = await supabase
          .from("treinos")
          .update({ conteudo: data as unknown as Json, descricao, updated_at: new Date().toISOString() })
          .eq("id", treino.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treinos").insert({
          aluno_id: alunoId,
          autor_id: user.id,
          descricao,
          conteudo: data as unknown as Json,
          status: "atual",
          versao: 1,
        });
        if (error) throw error;
      }
      toast.success("Treino salvo com sucesso!");
      onSaved?.();
      onBack();
    } catch (e: unknown) {
      toast.error("Erro ao salvar treino: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className="max-w-sm font-heading font-semibold"
          placeholder="Descrição do treino"
          readOnly={readOnly}
        />
        {!readOnly && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </div>

      {/* Aquecimento */}
      {data.aquecimento.length > 0 && (
        <div className="glass-card rounded-lg p-4">
          <h4 className="text-sm font-heading font-semibold text-primary mb-3">AQUECIMENTO</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1 px-2 w-16">Cat.</th>
                  <th className="text-left py-1 px-2">Exercício</th>
                  <th className="text-center py-1 px-2 w-16">Rep.</th>
                  <th className="text-center py-1 px-2 w-24">Dias</th>
                </tr>
              </thead>
              <tbody>
                {data.aquecimento.map((ex, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                        {ex.categoria}
                      </span>
                    </td>
                    <td className="py-1 px-2">
                      <ExerciseSelector
                        categoria={ex.categoria}
                        value={ex.exercicio}
                        onChange={(val) => updateExercise("aquecimento", 0, i, "exercicio", val)}
                        readOnly={readOnly}
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <Input
                        value={ex.repeticoes}
                        onChange={e => updateExercise("aquecimento", 0, i, "repeticoes", e.target.value)}
                        className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                        readOnly={readOnly}
                      />
                    </td>
                    <td className="py-1 px-2 text-center text-muted-foreground text-[10px]">
                      {ex.dias?.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Treinos */}
      {data.treinos.map((treino, tIdx) => (
        <div key={tIdx} className="glass-card rounded-lg p-4">
          <h4 className="text-sm font-heading font-semibold text-foreground mb-3">{treino.nome} — FORÇA</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1 px-2 w-8">#</th>
                  <th className="text-left py-1 px-2 w-16">Cat.</th>
                  <th className="text-left py-1 px-2">Exercício</th>
                  <th className="text-center py-1 px-2 w-16">Séries</th>
                  <th className="text-center py-1 px-2 w-16">Rep.</th>
                  <th className="text-center py-1 px-2 w-16">KG</th>
                </tr>
              </thead>
              <tbody>
                {treino.exercicios.map((ex, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 px-2 text-muted-foreground">{ex.ordem}</td>
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent/50 text-accent-foreground">
                        {ex.categoria}
                      </span>
                    </td>
                    <td className="py-1 px-2">
                      <ExerciseSelector
                        categoria={ex.categoria}
                        value={ex.exercicio}
                        onChange={(val) => updateExercise("treino", tIdx, i, "exercicio", val)}
                        readOnly={readOnly}
                      />
                    </td>
                    <td className="py-1 px-2 text-center">{ex.series}</td>
                    <td className="py-1 px-2 text-center">
                      <Input
                        value={ex.repeticoes}
                        onChange={e => updateExercise("treino", tIdx, i, "repeticoes", e.target.value)}
                        className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                        readOnly={readOnly}
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <Input
                        value={ex.kg || ""}
                        onChange={e => updateExercise("treino", tIdx, i, "kg", e.target.value)}
                        className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                        placeholder="—"
                        readOnly={readOnly}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
