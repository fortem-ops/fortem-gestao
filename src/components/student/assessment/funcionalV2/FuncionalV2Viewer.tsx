import type { Tables } from "@/integrations/supabase/types";
import { BodyMap } from "./BodyMap";
import { getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import type { MetricInput } from "./bodyMapLogic";

interface Props {
  avaliacao: Tables<"avaliacoes">;
}

export function FuncionalV2Viewer({ avaliacao }: Props) {
  const dados = (avaliacao.dados as Record<string, unknown>) || {};
  const metricas = (dados.metricas as MetricInput[] | undefined) || [];

  return (
    <div className="space-y-4">
      <BodyMap metrics={metricas} />

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

      {avaliacao.observacoes && (
        <div className="glass-card rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Observações</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{avaliacao.observacoes}</p>
        </div>
      )}
    </div>
  );
}
