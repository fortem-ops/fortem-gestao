import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StudentSummary } from "@/components/student/StudentSummary";
import { StudentWorkouts } from "@/components/student/StudentWorkouts";
import { StudentAssessments } from "@/components/student/StudentAssessments";
import { StudentHistory } from "@/components/student/StudentHistory";
import { StudentUploads } from "@/components/student/StudentUploads";
import { StudentPlan } from "@/components/student/StudentPlan";
import { StudentTasks } from "@/components/student/StudentTasks";
import { StudentNotes } from "@/components/student/StudentNotes";
import { StudentExerciseBank } from "@/components/student/StudentExerciseBank";
import EditStudentDialog from "@/components/student/EditStudentDialog";

const statusClass: Record<string, string> = { ativo: "status-active", licenca: "status-warning", encerrado: "status-urgent" };
const statusLabel: Record<string, string> = { ativo: "Ativo", licenca: "Licença", encerrado: "Encerrado" };

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("alunos").delete().eq("id", id!);
      if (error) throw error;
      toast.success("Aluno excluído com sucesso!");
      navigate("/alunos");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir aluno.");
    } finally {
      setDeleting(false);
    }
  }

  const { data: student, isLoading, refetch } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) {
    return <div className="text-center py-20 text-muted-foreground">Aluno não encontrado</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/alunos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-foreground">{student.nome}</h1>
            <Badge variant="outline" className={statusClass[student.status]}>
              {statusLabel[student.status] || student.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {student.email || "Sem email"} · {student.frequencia_semanal}x/semana
          </p>
        </div>
        <EditStudentDialog student={student} onStudentUpdated={() => refetch()} />
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" title="Excluir aluno">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir aluno</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{student.nome}</strong>? Esta ação é irreversível e todos os dados associados serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="bg-secondary/50 border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="plano">Plano/Serviços</TabsTrigger>
          <TabsTrigger value="treinos">Treinos</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          <TabsTrigger value="exercicios">Banco de Exercícios</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo"><StudentSummary student={student} /></TabsContent>
        <TabsContent value="plano"><StudentPlan student={student} /></TabsContent>
        <TabsContent value="treinos"><StudentWorkouts student={student} /></TabsContent>
        <TabsContent value="avaliacoes"><StudentAssessments student={student} /></TabsContent>
        <TabsContent value="exercicios"><StudentExerciseBank /></TabsContent>
        <TabsContent value="tarefas"><StudentTasks student={student} /></TabsContent>
        <TabsContent value="observacoes"><StudentNotes student={student} /></TabsContent>
        <TabsContent value="uploads"><StudentUploads student={student} /></TabsContent>
      </Tabs>
    </div>
  );
}
