import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { classifyAngle, assessmentReferences, getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { AvaliacaoAnexos } from "../AvaliacaoAnexos";
import { BodyMap } from "./BodyMap";
import { analyze, ALL_FUNCTIONAL_METRICS, type MetricInput } from "./bodyMapLogic";

interface Props {
  student: Tables<"alunos">;
  protocoloId: string | null;
  permiteUpload: boolean;
}

export function FuncionalV2Assessment({ student, protocoloId, permiteUpload }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleChange = (metric: string, side: "left" | "right", val: string) =>
    setValues((p) => ({ ...p, [metric]: { ...(p[metric] || { left: "", right: "" }), [side]: val } }));

  const rows: MetricInput[] = useMemo(() =>
    ALL_FUNCTIONAL_METRICS.map((metric) => {
      const v = values[metric] || { left: "", right: "" };
      const l = parseInt(v.left);
      const r = parseInt(v.right);
      return {
        metric,
        left: !isNaN(l) ? l : null,
        right: !isNaN(r) ? r : null,
        leftClass: !isNaN(l) ? classifyAngle(metric, l) : null,
        rightClass: !isNaN(r) ? classifyAngle(metric, r) : null,
      };
    }),
  [values]);

  const analysis = useMemo(() => analyze(rows, "asymmetry"), [rows]);

  const handleSave = async () => {
    if (!user) { toast.error("Usuário não autenticado"); return; }
    const hasAny = rows.some((r) => r.left !== null || r.right !== null);
    if (!hasAny) { toast.error("Insira ao menos um valor antes de salvar"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("avaliacoes")
        .insert({
          aluno_id: student.id,
          avaliador_id: user.id,
          tipo: "funcional_v2",
          protocolo_id: protocoloId,
          observacoes: notes || null,
          dados: {
            metricas: rows,
            score: analysis.scoreGeral,
            scoreMobilidade: analysis.scoreMobilidade,
            scoreSimetria: analysis.scoreSimetria,
            scoreEstabilidade: analysis.scoreEstabilidade,
            riskLevel: analysis.riskLevel,
            asymmetries: analysis.asymmetries,
            chains: analysis.chains.map((c) => ({ from: c.from, to: c.to, reason: c.reason })),
          },
        } as never)
        .select()
        .single();
      if (error) throw error;
      setSavedId(data.id);
      toast.success("Avaliação biomecânica salva");
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-aluno", student.id] });
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-global", student.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <BodyMap metrics={rows} />

      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Métrica</th>
              <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Esquerdo</th>
              <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. E</th>
              <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Direito</th>
              <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. D</th>
            </tr>
          </thead>
          <tbody>
            {ALL_FUNCTIONAL_METRICS.map((metric) => {
              const v = values[metric] || { left: "", right: "" };
              const l = parseInt(v.left);
              const r = parseInt(v.right);
              const lc = !isNaN(l) ? classifyAngle(metric, l) : null;
              const rc = !isNaN(r) ? classifyAngle(metric, r) : null;
              const ref = assessmentReferences[metric]?.referenceText;
              return (
                <tr key={metric} className="border-b border-border/50">
                  <td className="p-3">
                    <p className="text-sm text-foreground">{metric}</p>
                    {ref && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{ref}</p>}
                  </td>
                  <td className="p-3">
                    <Input type="number" className="w-16 text-center h-8 text-sm mx-auto" value={v.left} onChange={(e) => handleChange(metric, "left", e.target.value)} placeholder="°" />
                  </td>
                  <td className="p-3 text-center">
                    {lc && <span className={`text-xs font-semibold ${getClassificationColor(lc as AssessmentClassification)}`}>{lc}</span>}
                  </td>
                  <td className="p-3">
                    <Input type="number" className="w-16 text-center h-8 text-sm mx-auto" value={v.right} onChange={(e) => handleChange(metric, "right", e.target.value)} placeholder="°" />
                  </td>
                  <td className="p-3 text-center">
                    {rc && <span className={`text-xs font-semibold ${getClassificationColor(rc as AssessmentClassification)}`}>{rc}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">Observações do Avaliador</h4>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assimetrias, restrições, prioridades de intervenção..." rows={4} />
      </div>

      {permiteUpload && <AvaliacaoAnexos avaliacaoId={savedId} />}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Avaliação
        </Button>
      </div>
    </div>
  );
}
