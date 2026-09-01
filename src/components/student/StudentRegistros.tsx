import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentAssessments } from "@/components/student/StudentAssessments";
import { StudentNotes } from "@/components/student/StudentNotes";
import { StudentTasks } from "@/components/student/StudentTasks";
import { StudentUploads } from "@/components/student/StudentUploads";

export const REGISTROS_SUBTABS = ["avaliacoes", "observacoes", "tarefas", "uploads"] as const;
export type RegistroSubTab = (typeof REGISTROS_SUBTABS)[number];

function useCount(table: "avaliacoes" | "historico_profissional" | "tarefas" | "uploads", alunoId: string) {
  return useQuery({
    queryKey: ["registros-count", table, alunoId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", alunoId);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

function Counter({ value }: { value?: number }) {
  if (!value) return null;
  return (
    <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground">
      {value}
    </span>
  );
}

interface Props {
  student: Tables<"alunos">;
  value: RegistroSubTab;
  onValueChange: (v: RegistroSubTab) => void;
}

export function StudentRegistros({ student, value, onValueChange }: Props) {
  const { data: nAval } = useCount("avaliacoes", student.id);
  const { data: nObs } = useCount("historico_profissional", student.id);
  const { data: nTar } = useCount("tarefas", student.id);
  const { data: nUp } = useCount("uploads", student.id);

  return (
    <div className="mt-4">
      <Tabs value={value} onValueChange={(v) => onValueChange(v as RegistroSubTab)} className="w-full">
        <TabsList className="bg-secondary/30 border border-border/60 w-full justify-start overflow-x-auto h-9">
          <TabsTrigger value="avaliacoes" className="text-xs">
            Avaliações/Relatórios<Counter value={nAval} />
          </TabsTrigger>
          <TabsTrigger value="observacoes" className="text-xs">
            Observações<Counter value={nObs} />
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="text-xs">
            Tarefas<Counter value={nTar} />
          </TabsTrigger>
          <TabsTrigger value="uploads" className="text-xs">
            Uploads<Counter value={nUp} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacoes"><StudentAssessments student={student} /></TabsContent>
        <TabsContent value="observacoes"><StudentNotes student={student} /></TabsContent>
        <TabsContent value="tarefas"><StudentTasks student={student} /></TabsContent>
        <TabsContent value="uploads"><StudentUploads student={student} /></TabsContent>
      </Tabs>
    </div>
  );
}
