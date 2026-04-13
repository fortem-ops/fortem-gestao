import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mockStudents, getRemainingDays } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StudentSummary } from "@/components/student/StudentSummary";
import { StudentWorkouts } from "@/components/student/StudentWorkouts";
import { StudentAssessments } from "@/components/student/StudentAssessments";
import { StudentHistory } from "@/components/student/StudentHistory";
import { StudentUploads } from "@/components/student/StudentUploads";
import { StudentPlan } from "@/components/student/StudentPlan";
import { StudentTasks } from "@/components/student/StudentTasks";

const statusClass: Record<string, string> = { ativo: 'status-active', licenca: 'status-warning', encerrado: 'status-urgent' };
const statusLabel: Record<string, string> = { ativo: 'Ativo', licenca: 'Licença', encerrado: 'Encerrado' };

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const student = mockStudents.find(s => s.id === id);

  if (!student) {
    return <div className="text-center py-20 text-muted-foreground">Aluno não encontrado</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/alunos')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-foreground">{student.name}</h1>
            <Badge variant="outline" className={statusClass[student.status]}>{statusLabel[student.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{student.plan} · {student.responsible}</p>
        </div>
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="bg-secondary/50 border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="treinos">Treinos</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo"><StudentSummary student={student} /></TabsContent>
        <TabsContent value="treinos"><StudentWorkouts student={student} /></TabsContent>
        <TabsContent value="avaliacoes"><StudentAssessments student={student} /></TabsContent>
        <TabsContent value="historico"><StudentHistory student={student} /></TabsContent>
        <TabsContent value="uploads"><StudentUploads student={student} /></TabsContent>
        <TabsContent value="plano"><StudentPlan student={student} /></TabsContent>
        <TabsContent value="tarefas"><StudentTasks student={student} /></TabsContent>
      </Tabs>
    </div>
  );
}
