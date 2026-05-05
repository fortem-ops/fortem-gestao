import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dumbbell, Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// Lazy: this dialog pulls in WORKOUT_TEMPLATES (~30KB) + WorkoutDetail.
// Only load when the user actually opens the import flow.
const ImportFromBankDialog = lazy(() =>
  import("./workout/ImportFromBankDialog").then((m) => ({ default: m.ImportFromBankDialog })),
);
const ImportFromStudentDialog = lazy(() =>
  import("./workout/ImportFromStudentDialog").then((m) => ({ default: m.ImportFromStudentDialog })),
);
const WorkoutDetail = lazy(() =>
  import("./workout/WorkoutDetail").then((m) => ({ default: m.WorkoutDetail })),
);

type Treino = Tables<"treinos">;

export function StudentWorkouts({ student }: { student: Tables<"alunos"> }) {
  const { user } = useAuth();
  const [viewing, setViewing] = useState<Treino | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("treinos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Treino excluído com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir treino.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-heading font-semibold text-foreground">Histórico de Treinos</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Suspense fallback={null}>
            <ImportFromBankDialog alunoId={student.id} onSaved={() => refetch()} />
          </Suspense>
          <Suspense fallback={null}>
            <ImportFromStudentDialog alunoId={student.id} onSaved={() => refetch()} />
          </Suspense>
        </div>
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
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" title="Excluir treino" disabled={deletingId === t.id}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir treino</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir <strong>{t.descricao}</strong> (v{t.versao})? Esta ação é irreversível.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(t.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
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
