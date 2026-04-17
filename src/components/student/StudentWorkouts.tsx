import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dumbbell, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Lazy: this dialog pulls in WORKOUT_TEMPLATES (~30KB) + WorkoutDetail.
// Only load when the user actually opens the import flow.
const ImportFromBankDialog = lazy(() =>
  import("./workout/ImportFromBankDialog").then((m) => ({ default: m.ImportFromBankDialog })),
);
const WorkoutDetail = lazy(() =>
  import("./workout/WorkoutDetail").then((m) => ({ default: m.WorkoutDetail })),
);

type Treino = Tables<"treinos">;

export function StudentWorkouts({ student }: { student: Tables<"alunos"> }) {
  const [viewing, setViewing] = useState<Treino | null>(null);

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

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Histórico de Treinos</h3>
        <Suspense fallback={null}>
          <ImportFromBankDialog alunoId={student.id} onSaved={() => refetch()} />
        </Suspense>
      </div>

      {(!treinos || treinos.length === 0) ? (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhum treino registrado para este aluno.
        </div>
      ) : (
        <div className="space-y-2">
          {treinos.map(t => (
            <div
              key={t.id}
              className="glass-card rounded-lg p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{t.descricao}</span>
                  {t.status === "atual" ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                      Atual
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
                      Arquivado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  v{t.versao} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setViewing(t)}>
                <Eye className="w-3 h-3 mr-1" /> Visualizar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}>
              <WorkoutDetail
                alunoId={student.id}
                student={{ id: student.id, nome: student.nome }}
                treino={viewing}
                onBack={() => setViewing(null)}
                readOnly
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
