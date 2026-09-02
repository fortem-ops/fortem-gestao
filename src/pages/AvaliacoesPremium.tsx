import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StudentPicker } from "@/components/student/StudentPicker";
import { useAlunoAvaliacoesConsolidadas, useMobilidadeReferenceData, useMobilidadeAssimetriaReferenceData } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { assimetriasPorCategoria } from "@/components/avaliacoes-premium/DashboardSummary";
import { PremiumBodyMap } from "@/components/avaliacoes-premium/PremiumBodyMap";
import { ResultadosDateSelect, type ResultadosDateOption } from "@/components/avaliacoes-premium/ResultadosDateSelect";
import { computePremiumScores } from "@/components/avaliacoes-premium/scoringPremium";
import { gerarRecomendacoes } from "@/components/avaliacoes-premium/recomendacoesEngine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForcaTab } from "@/components/avaliacoes-premium/tabs/ForcaTab";
import { ComposicaoTab } from "@/components/avaliacoes-premium/tabs/ComposicaoTab";
import { EvolucaoTab } from "@/components/avaliacoes-premium/tabs/EvolucaoTab";
import { RecomendacoesTab } from "@/components/avaliacoes-premium/tabs/RecomendacoesTab";
import { PliometriaTab } from "@/components/avaliacoes-premium/tabs/PliometriaTab";
import { MobilidadeTab } from "@/components/avaliacoes-premium/tabs/MobilidadeTab";
import { ComparativoTab } from "@/components/avaliacoes-premium/tabs/ComparativoTab";
import { LancamentoView } from "@/components/avaliacoes-premium/lancamento/LancamentoView";
import { Loader2, Activity } from "lucide-react";
import type { Layer } from "@/components/student/assessment/funcionalV2/bodyMapLogic";

export default function AvaliacoesPremium() {
  const { alunoId: urlId } = useParams<{ alunoId?: string }>();
  const navigate = useNavigate();
  const [alunoId, setAlunoId] = useState<string>(urlId ?? "");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [layer, setLayer] = useState<Layer>("mobility");

  const { data, isLoading } = useAlunoAvaliacoesConsolidadas(alunoId || null);
  const { data: mobilidadeRef } = useMobilidadeReferenceData();
  const { data: assimetriaRef } = useMobilidadeAssimetriaReferenceData();
  const sexoAluno: "M" | "F" | undefined = data?.aluno?.sexo?.toLowerCase().startsWith("f")
    ? "F"
    : data?.aluno?.sexo?.toLowerCase().startsWith("m")
    ? "M"
    : undefined;

  const dateOptions = useMemo<ResultadosDateOption[]>(() => {
    if (!data) return [];
    const byDate = new Map<string, Set<string>>();
    const add = (date: string, category: string) => {
      const categories = byDate.get(date) ?? new Set<string>();
      categories.add(category);
      byDate.set(date, categories);
    };
    data.funcional.history.forEach((snapshot) => {
      if (snapshot.metricas.length > 0) add(snapshot.data, "Mob/Flex");
      if (snapshot.forca.length > 0) add(snapshot.data, "Força");
    });
    data.composicao.history.forEach((snapshot) => add(snapshot.data, "Composição"));
    data.pliometria.history.forEach((snapshot) => add(snapshot.data, "Pliometria"));
    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, categories]) => ({ date, categories: Array.from(categories) }));
  }, [data]);

  useEffect(() => {
    setSelectedDate(dateOptions[0]?.date ?? "");
  }, [alunoId, dateOptions]);

  const funcionalDaData = useMemo(() => {
    if (!selectedDate || !data) return null;
    const snapshots = data.funcional.history.filter((snapshot) => snapshot.data === selectedDate);
    if (snapshots.length === 0) return null;
    return {
      ...snapshots[0],
      metricas: snapshots.find((snapshot) => snapshot.metricas.length > 0)?.metricas ?? [],
      forca: snapshots.find((snapshot) => snapshot.forca.length > 0)?.forca ?? [],
    };
  }, [data, selectedDate]);
  const composicaoDaData = data?.composicao.history.find((snapshot) => snapshot.data === selectedDate) ?? null;
  const pliometriaDaData = data?.pliometria.history.find((snapshot) => snapshot.data === selectedDate) ?? null;

  const scores = useMemo(
    () =>
      data
        ? computePremiumScores(funcionalDaData, composicaoDaData, sexoAluno, mobilidadeRef, assimetriaRef)
        : null,
    [data, funcionalDaData, composicaoDaData, sexoAluno, mobilidadeRef, assimetriaRef],
  );
  const recomendacoes = useMemo(
    () => (scores && data ? gerarRecomendacoes(scores, data.funcional.latest, data.composicao.latest) : []),
    [scores, data],
  );
  const forcaResumo = useMemo(
    () =>
      (data?.funcional.latest?.forca ?? []).map((e) => ({
        nome: e.nome,
        direito_kg: e.direito_kg,
        esquerdo_kg: e.esquerdo_kg,
      })),
    [data],
  );
  const resumoGeral = useMemo(
    () => (scores ? assimetriasPorCategoria(scores, forcaResumo).geral : null),
    [scores, forcaResumo],
  );

  function handlePick(id: string) {
    setAlunoId(id);
    navigate(`/avaliacoes-premium/${id}`, { replace: true });
  }

  return (
    <div data-bio-theme="light" className="bio-shell -m-6 p-6 min-h-[calc(100vh-3.5rem)]">
      <header className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <Activity className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="bio-label">FORTEM · Central Biomecânica</p>
            <h1 className="bio-heading text-2xl">Avaliações</h1>
          </div>
        </div>
        <div className="md:w-96">
          <StudentPicker value={alunoId} onChange={handlePick} placeholder="Selecione um aluno..." />
        </div>
      </header>

      {!alunoId && (
        <div className="bio-card p-10 text-center text-[hsl(var(--bio-ink-muted))]">
          Selecione um aluno para abrir o dashboard biomecânico premium.
        </div>
      )}

      {alunoId && isLoading && (
        <div className="bio-card p-10 flex items-center justify-center text-[hsl(var(--bio-ink-muted))]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando dados consolidados...
        </div>
      )}

      {alunoId && !isLoading && data?.aluno && (
        <Tabs defaultValue="lancamento" className="space-y-5">
          <TabsList className="bg-[hsl(var(--bio-surface-2))] border border-[hsl(var(--bio-line))]">
            <TabsTrigger value="lancamento">Lançamento</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
          </TabsList>

          <TabsContent value="lancamento" className="mt-0">
            <LancamentoView alunoId={alunoId} data={data} mobilidadeRef={mobilidadeRef} />
          </TabsContent>

          <TabsContent value="resultados" className="mt-0">
            {scores && (
              <div className="min-w-0 space-y-5">
                  {resumoGeral && (
                    <div className="bio-card px-4 py-3 flex items-center gap-3">
                      <span className="bio-label">Resumo geral</span>
                      <span className="text-sm font-semibold text-[hsl(var(--bio-ink))]">
                        {resumoGeral.alta + resumoGeral.moderada} alerta(s) ativo(s) — {resumoGeral.alta} elevada(s), {resumoGeral.moderada} moderada(s)
                      </span>
                    </div>
                  )}

                  <PremiumBodyMap funcional={data.funcional.latest} scores={scores} />

                  <Tabs defaultValue="mobilidade" className="bio-card p-4">
                    <TabsList className="bg-[hsl(var(--bio-surface-2))] border border-[hsl(var(--bio-line))]">
                      <TabsTrigger value="mobilidade">Mobilidade/Flexibilidade</TabsTrigger>
                      <TabsTrigger value="forca">Força</TabsTrigger>
                      <TabsTrigger value="composicao">Composição</TabsTrigger>
                      <TabsTrigger value="pliometria">Pliometria</TabsTrigger>
                      <TabsTrigger value="evolucao">Evolução</TabsTrigger>
                      <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
                      <TabsTrigger value="recomendacoes">Recomendações</TabsTrigger>
                    </TabsList>
                    <TabsContent value="mobilidade" className="mt-4">
                      <MobilidadeTab
                        alunoId={alunoId}
                        latest={data.funcional.latest}
                        history={data.funcional.history}
                        aluno={data.aluno}
                        referenceData={mobilidadeRef}
                        readOnly
                      />
                    </TabsContent>
                    <TabsContent value="forca" className="mt-4">
                      <ForcaTab alunoId={alunoId} latest={data.funcional.latest} history={data.funcional.history} aluno={data.aluno} readOnly />
                    </TabsContent>
                    <TabsContent value="composicao" className="mt-4">
                      <ComposicaoTab alunoId={alunoId} latest={data.composicao.latest} history={data.composicao.history} readOnly />
                    </TabsContent>
                    <TabsContent value="pliometria" className="mt-4">
                      <PliometriaTab alunoId={alunoId} latest={data.pliometria.latest} history={data.pliometria.history} readOnly />
                    </TabsContent>
                    <TabsContent value="evolucao" className="mt-4">
                      <EvolucaoTab data={data} />
                    </TabsContent>
                    <TabsContent value="comparativo" className="mt-4">
                      <ComparativoTab data={data} alunoId={alunoId} />
                    </TabsContent>
                    <TabsContent value="recomendacoes" className="mt-4">
                      <RecomendacoesTab recomendacoes={recomendacoes} />
                    </TabsContent>
                  </Tabs>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
