import type { Tables } from "@/integrations/supabase/types";
import { BodyMap } from "./BodyMap";
import { getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import {
  ASSIMETRIA_NIVEL_LABEL,
  FORCA_EXERCICIO_LABEL,
  classificarAssimetria,
  getMetricDisplayLabel,
  type AssimetriaNivel,
  type ForcaInput,
  type MetricInput,
  type MobilidadeReferenceData,
} from "./bodyMapLogic";
import type { FaixaEtaria } from "@/lib/faixaEtaria";

const NIVEL_CLS: Record<AssimetriaNivel, string> = {
  nenhuma: "text-emerald-500",
  moderada: "text-amber-500",
  severa: "text-rose-500",
};

/** Diferença entre os lados com o nível de assimetria (regra compartilhada). */
export function AssimetriaCelula({ metric, left, right }: { metric: string; left: number | null; right: number | null }) {
  const info = classificarAssimetria(metric, left, right);
  if (!info) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`text-xs font-semibold ${NIVEL_CLS[info.nivel]}`}>
      {info.valor.toFixed(1)}{info.unidade} · {ASSIMETRIA_NIVEL_LABEL[info.nivel]}
    </span>
  );
}


interface Props {
  avaliacao: Tables<"avaliacoes">;
  sexo?: "M" | "F";
  faixaEtaria?: FaixaEtaria | null;
  referenceData?: MobilidadeReferenceData;
}

interface ForcaSaved {
  laudoPath?: string | null;
  importadoEm?: string | null;
  exercicios?: Array<{
    nome: ForcaInput["nome"];
    direito_kg: number;
    esquerdo_kg: number;
    assimetria?: number;
    classificacao?: AssessmentClassification;
  }>;
  scoreForca?: number | null;
}

export function FuncionalV2Viewer({ avaliacao, sexo, faixaEtaria, referenceData }: Props) {
  const dados = (avaliacao.dados as Record<string, unknown>) || {};
  const metricas = (dados.metricas as MetricInput[] | undefined) || [];
  const forca = dados.forca as ForcaSaved | null | undefined;
  const forcaInputs: ForcaInput[] = (forca?.exercicios ?? []).map((e) => ({
    nome: e.nome, direito_kg: e.direito_kg, esquerdo_kg: e.esquerdo_kg,
  }));

  return (
    <div className="space-y-4">
      <BodyMap metrics={metricas} forcaExercises={forcaInputs} sexo={sexo} faixaEtaria={faixaEtaria} referenceData={referenceData} />

      {metricas.length > 0 && (
        <div className="glass-card rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Métrica</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Esq.</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. E</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Dir.</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. D</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((m) => (
                <tr key={m.metric} className="border-b border-border/40">
                  <td className="p-3">{m.metric}</td>
                  <td className="p-3 text-center">{m.left !== null ? `${m.left}°` : "—"}</td>
                  <td className="p-3 text-center">
                    {m.leftClass && <span className={`text-xs font-semibold ${getClassificationColor(m.leftClass as AssessmentClassification)}`}>{m.leftClass}</span>}
                  </td>
                  <td className="p-3 text-center">{m.right !== null ? `${m.right}°` : "—"}</td>
                  <td className="p-3 text-center">
                    {m.rightClass && <span className={`text-xs font-semibold ${getClassificationColor(m.rightClass as AssessmentClassification)}`}>{m.rightClass}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {forca?.exercicios && forca.exercicios.length > 0 && (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Força (Dinamometria)</h4>
            {forca.laudoPath && <span className="text-[10px] text-blue-400">laudo Kinology importado</span>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Exercício</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">D (kg)</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">E (kg)</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Assimetria</th>
                <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class.</th>
              </tr>
            </thead>
            <tbody>
              {forca.exercicios.map((ex) => (
                <tr key={ex.nome} className="border-b border-border/40">
                  <td className="p-3">{FORCA_EXERCICIO_LABEL[ex.nome]}</td>
                  <td className="p-3 text-center">{ex.direito_kg}</td>
                  <td className="p-3 text-center">{ex.esquerdo_kg}</td>
                  <td className="p-3 text-center text-xs text-muted-foreground">{ex.assimetria != null ? `${ex.assimetria.toFixed(1)}%` : "—"}</td>
                  <td className="p-3 text-center">
                    {ex.classificacao && <span className={`text-xs font-semibold ${getClassificationColor(ex.classificacao)}`}>{ex.classificacao}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {avaliacao.observacoes && (
        <div className="glass-card rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Observações</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{avaliacao.observacoes}</p>
        </div>
      )}
    </div>
  );
}
