import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StudentPicker } from "@/components/student/StudentPicker";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { AlunoSidebarCard } from "@/components/avaliacoes-premium/AlunoSidebarCard";
import { DashboardSummary } from "@/components/avaliacoes-premium/DashboardSummary";
import { PremiumBodyMap } from "@/components/avaliacoes-premium/PremiumBodyMap";
import { PremiumKinologyImport } from "@/components/avaliacoes-premium/PremiumKinologyImport";
import { computePremiumScores } from "@/components/avaliacoes-premium/scoringPremium";
import { gerarRecomendacoes } from "@/components/avaliacoes-premium/recomendacoesEngine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForcaTab } from "@/components/avaliacoes-premium/tabs/ForcaTab";
import { ComposicaoTab } from "@/components/avaliacoes-premium/tabs/ComposicaoTab";
import { EvolucaoTab } from "@/components/avaliacoes-premium/tabs/EvolucaoTab";
import { RecomendacoesTab } from "@/components/avaliacoes-premium/tabs/RecomendacoesTab";
import { PliometriaTab } from "@/components/avaliacoes-premium/tabs/PliometriaTab";
import { MobilidadeTab } from "@/components/avaliacoes-premium/tabs/MobilidadeTab";

import { Loader2, Activity } from "lucide-react";

export default function AvaliacoesPremium() {
  const { alunoId: urlId } = useParams<{ alunoId?: string }>();
  const navigate = useNavigate();
  const [alunoId, setAlunoId] = useState<string>(urlId ?? "");

  const { data, isLoading } = useAlunoAvaliacoesConsolidadas(alunoId || null);

  const scores = useMemo(
    () =>
      data
        ? computePremiumScores(data.funcional.latest, data.composicao.latest)
        : null,
    [data],
  );
  const recomendacoes = useMemo(
    () => (scores && data ? gerarRecomendacoes(scores, data.funcional.latest, data.composicao.latest) : []),
    [scores, data],
  );

  function handlePick(id: string) {
    setAlunoId(id);
    navigate(`/avaliacoes-premium/${id}`, { replace: true });
  }

  return (
    <div className="bio-shell -m-6 p-6 min-h-[calc(100vh-3.5rem)]">
      <header className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <Activity className="w-5 h-5 text-rose-300" />
          </div>
          <div>
            <p className="bio-label">FORTEM · Central Biomecânica</p>
            <h1 className="bio-heading text-2xl">Avaliações Premium</h1>
          </div>
        </div>
        <div className="md:w-96">
          <StudentPicker value={alunoId} onChange={handlePick} placeholder="Selecione um aluno..." />
        </div>
      </header>

      {!alunoId && (
        <div className="bio-card p-10 text-center text-white/55">
          Selecione um aluno para abrir o dashboard biomecânico premium.
        </div>
      )}

      {alunoId && isLoading && (
        <div className="bio-card p-10 flex items-center justify-center text-white/55">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando dados consolidados...
        </div>
      )}

      {alunoId && !isLoading && data?.aluno && scores && (
        <div className="flex flex-col lg:flex-row gap-5">
          <AlunoSidebarCard
            aluno={data.aluno}
            avaliadorNome={data.avaliador?.nome ?? null}
            ultimaAvaliacaoData={data.raw[0]?.data ?? null}
          />

          <div className="flex-1 min-w-0 space-y-5">
            <DashboardSummary scores={scores} />
            <PremiumKinologyImport alunoId={alunoId} />
            <PremiumBodyMap funcional={data.funcional.latest} />

            <Tabs defaultValue="forca" className="bio-card p-4">
              <TabsList className="bg-white/5 border border-white/5">
                <TabsTrigger value="forca">Força</TabsTrigger>
                <TabsTrigger value="composicao">Composição</TabsTrigger>
                <TabsTrigger value="pliometria">Pliometria</TabsTrigger>
                <TabsTrigger value="evolucao">Evolução</TabsTrigger>
                <TabsTrigger value="recomendacoes">Recomendações</TabsTrigger>
              </TabsList>
              <TabsContent value="forca" className="mt-4">
                <ForcaTab latest={data.funcional.latest} history={data.funcional.history} />
              </TabsContent>
              <TabsContent value="composicao" className="mt-4">
                <ComposicaoTab latest={data.composicao.latest} history={data.composicao.history} />
              </TabsContent>
              <TabsContent value="pliometria" className="mt-4">
                <PliometriaTab alunoId={alunoId} latest={data.pliometria.latest} history={data.pliometria.history} />
              </TabsContent>
              <TabsContent value="evolucao" className="mt-4">
                <EvolucaoTab data={data} />
              </TabsContent>
              <TabsContent value="recomendacoes" className="mt-4">
                <RecomendacoesTab recomendacoes={recomendacoes} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
