import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, DollarSign, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StudentSummary } from "@/components/student/StudentSummary";
import { StudentFinanceiro } from "@/components/student/StudentFinanceiro";
import { StudentWorkouts } from "@/components/student/StudentWorkouts";
import { StudentAssessments } from "@/components/student/StudentAssessments";
import { StudentHistory } from "@/components/student/StudentHistory";
import { StudentUploads } from "@/components/student/StudentUploads";
import { StudentPlan } from "@/components/student/StudentPlan";
import { StudentTasks } from "@/components/student/StudentTasks";
import { StudentNotes } from "@/components/student/StudentNotes";
import EditStudentDialog from "@/components/student/EditStudentDialog";
import { VendaDialog } from "@/components/student/venda/VendaDialog";
import { StudentPipelinePanel } from "@/components/pipeline/StudentPipelinePanel";
import { ConvertToProspectDialog } from "@/components/leads/ConvertToProspectDialog";
import { StudentClubePanel } from "@/components/clube/StudentClubePanel";
import ContratoFinanceiro from "@/pages/alunos/ContratoFinanceiro";
import { getDisplayStatus } from "@/lib/studentStatus";
import { selecionarPlanoExibicao, planoDataFim } from "@/lib/planoPrincipal";
import type { AlunoLicenca } from "@/lib/licencas";
import { addMonths } from "date-fns";



export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [vendaOpen, setVendaOpen] = useState(false);
  const [reativarOpen, setReativarOpen] = useState(false);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ["resumo","pipeline","clube","plano","financeiro","contrato","treinos","avaliacoes","tarefas","observacoes","uploads"];
  const tabParam = searchParams.get("tab");
  const tabValue = tabParam && validTabs.includes(tabParam) ? tabParam : "resumo";

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

  const { data: responsavelNome } = useQuery({
    queryKey: ["aluno-responsavel-nome", student?.responsavel_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", student!.responsavel_id!)
        .maybeSingle();
      return data?.full_name || null;
    },
    enabled: !!student?.responsavel_id,
  });


  const { data: statusInfo } = useQuery({
    queryKey: ["aluno_display_status", id],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos").select("*").eq("aluno_id", id!).eq("ativo", true)
        .order("created_at", { ascending: false });
      // O aluno pode ter mais de um plano ativo (ex.: plano principal + Corrida).
      // Seleção determinística: principal vigente → Corrida vigente → mais recente.
      const { plano, corridaOnly } = selecionarPlanoExibicao(planos as any[]);
      const planEnd = planoDataFim(plano);
      let licencas: AlunoLicenca[] = [];
      if (plano?.id) {
        const { data } = await supabase.from("aluno_licencas" as any)
          .select("*").eq("aluno_id", id!).eq("plano_id", plano.id);
        licencas = (data as unknown as AlunoLicenca[]) || [];
      }
      return { planEnd, licencas, planTipo: plano?.tipo ?? null, corridaOnly };
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

  const displayStatus = getDisplayStatus(
    student.status,
    statusInfo?.planEnd ?? null,
    statusInfo?.licencas ?? [],
    statusInfo?.planTipo ?? null,
    { corridaOnly: statusInfo?.corridaOnly },
  );

  const podeReativar = displayStatus.key === "encerrado";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/alunos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-foreground">{student.nome}</h1>
            <Badge variant="outline" className={displayStatus.className}>{displayStatus.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {student.email || "Sem email"} · {student.frequencia_semanal === 5 ? "Livre" : `${student.frequencia_semanal}x/semana`}
          </p>
        </div>
        <EditStudentDialog student={student} onStudentUpdated={() => refetch()} />
        {podeReativar && (
          <Button variant="outline" size="sm" onClick={() => setReativarOpen(true)} className="gap-1">
            <RefreshCw className="w-4 h-4" />
            Reativar como Prospect
          </Button>
        )}
        <Button variant="default" size="sm" onClick={() => setVendaOpen(true)} className="gap-1">
          <DollarSign className="w-4 h-4" />
          Nova venda
        </Button>
        <ConvertToProspectDialog
          alunoId={student.id}
          open={reativarOpen}
          onOpenChange={setReativarOpen}
          title={`Reativar ${student.nome} como Prospect`}
          description="Revise os dados e atualize a anamnese antes de retornar o ex-aluno ao funil de prospects."
          confirmLabel="Reativar como Prospect"
          successMessage="Ex-aluno reativado como Prospect"
          movementNote="Reativação de ex-aluno"
          onConverted={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["aluno_display_status", id] });
            queryClient.invalidateQueries({ queryKey: ["trajetoria_aluno", id] });
            queryClient.invalidateQueries({ queryKey: ["prospect_anamnese", id] });
          }}
        />
        <VendaDialog
          alunoId={student.id}
          alunoNome={student.nome}
          open={vendaOpen}
          onOpenChange={setVendaOpen}
        />
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

      <Tabs
        value={tabValue}
        onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        className="w-full"
      >
        <TabsList className="bg-secondary/50 border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="clube">Clube FORTEM</TabsTrigger>
          <TabsTrigger value="plano">Plano/Serviços</TabsTrigger>
          <TabsTrigger value="financeiro">Carteira</TabsTrigger>
          <TabsTrigger value="contrato">Pagamentos</TabsTrigger>
          <TabsTrigger value="treinos">Treinos</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo"><StudentSummary student={student} /></TabsContent>
        <TabsContent value="pipeline"><StudentPipelinePanel student={student} onChanged={() => refetch()} /></TabsContent>
        <TabsContent value="clube"><StudentClubePanel student={student} /></TabsContent>
        <TabsContent value="plano"><StudentPlan student={student} /></TabsContent>
        <TabsContent value="financeiro"><StudentFinanceiro student={student} /></TabsContent>
        <TabsContent value="contrato"><ContratoFinanceiro alunoId={student.id} /></TabsContent>
        <TabsContent value="treinos"><StudentWorkouts student={student} /></TabsContent>
        <TabsContent value="avaliacoes"><StudentAssessments student={student} /></TabsContent>
        <TabsContent value="tarefas"><StudentTasks student={student} /></TabsContent>
        <TabsContent value="observacoes"><StudentNotes student={student} /></TabsContent>
        <TabsContent value="uploads"><StudentUploads student={student} /></TabsContent>
      </Tabs>
    </div>
  );
}
