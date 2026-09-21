import { Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PortalAssessmentMobile } from "@/components/portal/PortalAssessmentMobile";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { useMobilidadeResumoReferencia } from "@/components/portal/referenciaResumoPortal";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { faixaEtariaDe, sexoDe } from "@/lib/faixaEtaria";

export default function PortalAssessments() {
  const { student } = useStudentPortal();
  const { data, isLoading } = useAlunoAvaliacoesConsolidadas(student?.id);
  const { data: resumoReferencia } = useMobilidadeResumoReferencia();

  if (!student) return null;

  if (isLoading) {
    return (
      <div className="space-y-4 pb-32" aria-label="Carregando avaliação">
        <div className="h-16 animate-pulse rounded-xl bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  if (!data?.funcional.latest) {
    return (
      <div className="space-y-5 pb-32 pt-2">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Avaliação funcional</p>
          <h1 className="font-heading text-2xl font-black text-foreground">Minha avaliação</h1>
        </header>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-heading text-sm font-bold text-foreground">Você ainda não tem avaliação funcional</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A avaliação identifica mobilidade, equilíbrio entre os lados e força para orientar seu treino.</p>
            </div>
          </div>
          <Button asChild className="min-h-11 w-full font-bold">
            <Link to="/portal/agenda">Agendar avaliação funcional <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 animate-fade-in pb-32">
      <PortalAssessmentMobile
        data={data}
        sexo={sexoDe(student.sexo)}
        faixaEtaria={faixaEtariaDe(student.data_nascimento)}
        resumoReferencia={resumoReferencia}
      />
    </div>
  );
}