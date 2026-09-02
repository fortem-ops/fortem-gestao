import { useMemo, useState } from "react";
import { Activity, Dumbbell, PersonStanding, Zap } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { CategoriaCard } from "./CategoriaCard";
import { MobilidadeTab } from "../tabs/MobilidadeTab";
import { ForcaTab } from "../tabs/ForcaTab";
import { ComposicaoTab } from "../tabs/ComposicaoTab";
import { PliometriaTab } from "../tabs/PliometriaTab";
import type { ConsolidadoAluno } from "../useAlunoAvaliacoesConsolidadas";
import type { MobilidadeReferenceData } from "@/components/student/assessment/funcionalV2/bodyMapLogic";

interface Props {
  alunoId: string;
  data: ConsolidadoAluno;
  mobilidadeRef?: MobilidadeReferenceData;
}

export function LancamentoView({ alunoId, data, mobilidadeRef }: Props) {
  const [aberto, setAberto] = useState<string>("");

  const ultimaMobilidade = useMemo(
    () => data.funcional.history.find((s) => s.metricas.some((m) => m.left !== null || m.right !== null))?.data ?? null,
    [data.funcional.history],
  );
  const ultimaForca = useMemo(
    () => data.funcional.history.find((s) => s.forca.length > 0)?.data ?? null,
    [data.funcional.history],
  );
  const ultimaComposicao = data.composicao.latest?.data ?? null;
  const ultimaPliometria = data.pliometria.latest?.data ?? null;

  return (
    <Accordion
      type="single"
      collapsible
      value={aberto}
      onValueChange={setAberto}
      className="space-y-3"
    >
      <CategoriaCard
        value="mobilidade"
        titulo="Mobilidade / Flexibilidade"
        descricao="Lançamento manual de amplitudes por métrica"
        icon={PersonStanding}
        ultimaData={ultimaMobilidade}
      >
        <MobilidadeTab
          alunoId={alunoId}
          latest={data.funcional.latest}
          history={data.funcional.history}
          aluno={data.aluno}
          referenceData={mobilidadeRef}
          initialFormOpen
        />
      </CategoriaCard>

      <CategoriaCard
        value="forca"
        titulo="Força / Kinology"
        descricao="Importação de laudo de dinamometria (PDF)"
        icon={Dumbbell}
        ultimaData={ultimaForca}
      >
        <ForcaTab
          alunoId={alunoId}
          latest={data.funcional.latest}
          history={data.funcional.history}
          aluno={data.aluno}
        />
      </CategoriaCard>

      <CategoriaCard
        value="composicao"
        titulo="Composição Corporal"
        descricao="Protocolo Pollock 7 dobras"
        icon={Activity}
        ultimaData={ultimaComposicao}
      >
        <ComposicaoTab
          alunoId={alunoId}
          latest={data.composicao.latest}
          history={data.composicao.history}
        />
      </CategoriaCard>

      <CategoriaCard
        value="pliometria"
        titulo="Pliometria"
        descricao="Saltos, RSI, potência e stiffness"
        icon={Zap}
        ultimaData={ultimaPliometria}
      >
        <PliometriaTab
          alunoId={alunoId}
          latest={data.pliometria.latest}
          history={data.pliometria.history}
        />
      </CategoriaCard>
    </Accordion>
  );
}
