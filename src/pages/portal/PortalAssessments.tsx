import { Activity, ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PortalAssessmentMobile } from "@/components/portal/PortalAssessmentMobile";
import { EvolucaoFrequenciaAba } from "@/components/portal/EvolucaoFrequenciaAba";
import { EvolucaoConquistasAba } from "@/components/portal/EvolucaoConquistasAba";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { useMobilidadeResumoReferencia } from "@/components/portal/referenciaResumoPortal";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { faixaEtariaDe, sexoDe } from "@/lib/faixaEtaria";
import { agendaOculta } from "@/lib/portalAgenda";
import { cn } from "@/lib/utils";

type AbaEvolucao = "frequencia" | "avaliacoes" | "conquistas";

export default function PortalAssessments() {
  const { student, somenteOnline } = useStudentPortal();
  const [params, setParams] = useSearchParams();
  const abaParam = params.get("aba");
  const aba: AbaEvolucao =
    abaParam === "avaliacoes" || abaParam === "conquistas" ? abaParam : "frequencia";
  const { data, isLoading } = useAlunoAvaliacoesConsolidadas(student?.id);
  const { data: resumoReferencia } = useMobilidadeResumoReferencia();

  if (!student) return null;

  const trocarAba = (v: AbaEvolucao) => {
    const p = new URLSearchParams(params);
    if (v === "frequencia") p.delete("aba");
    else p.set("aba", v);
    setParams(p, { replace: true });
  };

  const abas = (
    <div className="grid grid-cols-3 border-b border-[#4A4B4B] pt-2" role="tablist" style={{ fontFamily: "Archivo, sans-serif" }}>
      {(["frequencia", "avaliacoes", "conquistas"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={aba === v}
          onClick={() => trocarAba(v)}
          className={cn(
            "min-h-[44px] border-b-2 text-[12px] font-bold uppercase tracking-[0.08em]",
            aba === v ? "border-[#C8282A] text-foreground" : "border-transparent text-[#B1B3B3]",
          )}
        >
          {v === "frequencia" ? "Frequência" : v === "avaliacoes" ? "Avaliações" : "Conquistas"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {abas}
      {aba === "frequencia" ? (
        <EvolucaoFrequenciaAba />
      ) : aba === "conquistas" ? (
        <EvolucaoConquistasAba />
      ) : isLoading ? (
        <div className="portal-evolucao space-y-4 pb-24" aria-label="Carregando avaliação">
          <div className="h-16 animate-pulse bg-card" />
          <div className="h-64 animate-pulse border border-border bg-card" />
        </div>
      ) : !data?.funcional.latest ? (
        <div className="portal-evolucao space-y-5 pb-24 pt-2">
          <header>
            <p className="evolution-section-label">Avaliação funcional</p>
            <h1 className="font-heading text-2xl font-black text-foreground">EVOLUÇÃO</h1>
          </header>
          <div className="space-y-4 border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-secondary">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-heading text-sm font-bold text-foreground">Você ainda não tem avaliação funcional</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A avaliação identifica mobilidade, equilíbrio entre os lados e força para orientar seu treino.</p>
              </div>
            </div>
            {!agendaOculta(somenteOnline) && (
              <Button asChild className="min-h-11 w-full font-bold">
                <Link to="/portal/agenda">Agendar avaliação funcional <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="min-w-0 animate-fade-in pb-24">
          <PortalAssessmentMobile
            data={data}
            sexo={sexoDe(student.sexo)}
            faixaEtaria={faixaEtariaDe(student.data_nascimento)}
            resumoReferencia={resumoReferencia}
          />
        </div>
      )}
    </div>
  );
}