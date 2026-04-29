import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssessmentViewerDialog } from "@/components/student/assessment/AssessmentViewerDialog";
import type { Tables } from "@/integrations/supabase/types";

const tipoLabel: Record<string, string> = {
  funcional: "Avaliação Funcional",
  composicao_corporal: "Composição Corporal",
  fisica: "Avaliação Física",
};

export default function PortalAssessments() {
  const { student } = useStudentPortal();
  const [viewing, setViewing] = useState<Tables<"avaliacoes"> | null>(null);

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["portal-avaliacoes", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student!.id)
        .order("data", { ascending: false });
      return (data || []) as Tables<"avaliacoes">[];
    },
  });

  const atual = avaliacoes[0];
  const historico = avaliacoes.slice(1);

  if (!student) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-heading font-bold text-lg flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-primary" /> Avaliações
      </h1>

      {avaliacoes.length === 0 ? (
        <Card className="glass-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma avaliação registrada ainda.
        </Card>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Mais recente</h2>
            <AvCard a={atual} onView={setViewing} highlight />
          </section>

          {historico.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Histórico</h2>
              <div className="space-y-2">
                {historico.map((a) => (
                  <AvCard key={a.id} a={a} onView={setViewing} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AssessmentViewerDialog
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        avaliacao={viewing}
        student={student}
      />
    </div>
  );
}

function AvCard({
  a,
  onView,
  highlight,
}: {
  a: Tables<"avaliacoes">;
  onView: (a: Tables<"avaliacoes">) => void;
  highlight?: boolean;
}) {
  return (
    <Card className={`glass-card p-4 ${highlight ? "border-primary/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{tipoLabel[a.tipo] || a.tipo}</p>
            {highlight && (
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">Atual</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(a.data + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onView(a)}>
          <Eye className="w-3 h-3 mr-1" /> Ver
        </Button>
      </div>
    </Card>
  );
}
