import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_FUNCTIONAL_METRICS,
  type MetricInput,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  classifyAngle,
  assessmentReferences,
  getClassificationColor,
} from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { getFuncionalV2DefaultProtocoloId } from "@/lib/kinologyImport";
import { AssessmentDateField, todayISO } from "../AssessmentDateField";

interface Props {
  alunoId: string;
}

/**
 * Aba de entrada manual de mobilidade/flexibilidade na tela Avaliações Premium.
 * Espelha a lógica do Kinology (força): tenta mesclar em uma avaliação
 * funcional_v2 existente que já tenha força mas ainda não tem métricas.
 * Caso contrário, cria uma nova linha só com mobilidade.
 */
export function MobilidadeTab({ alunoId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>({});
  const [data, setData] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);

  const handleChange = (metric: string, side: "left" | "right", val: string) =>
    setValues((p) => ({
      ...p,
      [metric]: { ...(p[metric] || { left: "", right: "" }), [side]: val },
    }));

  const rows: MetricInput[] = useMemo(
    () =>
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
    [values],
  );

  const preenchidos = rows.filter((r) => r.left !== null || r.right !== null);

  async function findFuncionalV2AguardandoMobilidade() {
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id, data, dados")
      .eq("aluno_id", alunoId)
      .eq("tipo", "funcional_v2")
      .order("data", { ascending: false })
      .limit(10);
    if (error) throw error;
    for (const row of data ?? []) {
      const dados = (row.dados as Record<string, unknown>) || {};
      const metricas = dados.metricas as unknown[] | undefined;
      const forca = dados.forca as { exercicios?: unknown[] } | null | undefined;
      const temMetricas = Array.isArray(metricas) && metricas.length > 0;
      const temForca = !!forca && Array.isArray(forca.exercicios) && forca.exercicios.length > 0;
      if (temForca && !temMetricas) {
        return { id: row.id, dados };
      }
    }
    return null;
  }

  async function handleSave() {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (preenchidos.length === 0) {
      toast.error("Preencha ao menos uma métrica antes de salvar");
      return;
    }
    setSaving(true);
    try {
      const pendente = await findFuncionalV2AguardandoMobilidade();
      if (pendente) {
        const novosDados = { ...pendente.dados, metricas: rows };
        const { error } = await supabase
          .from("avaliacoes")
          .update({ dados: novosDados } as never)
          .eq("id", pendente.id);
        if (error) throw error;
        toast.success("Mobilidade mesclada com sucesso", {
          description: `${preenchidos.length} métrica(s) integradas à avaliação existente.`,
        });
      } else {
        const protocoloId = await getFuncionalV2DefaultProtocoloId();
        if (!protocoloId) throw new Error("Protocolo padrão de funcional_v2 não encontrado");
        const { error } = await supabase.from("avaliacoes").insert({
          aluno_id: alunoId,
          avaliador_id: user.id,
          tipo: "funcional_v2",
          protocolo_id: protocoloId,
          data: new Date().toISOString().slice(0, 10),
          dados: { metricas: rows, forca: null },
        } as never);
        if (error) throw error;
        toast.success("Mobilidade registrada", {
          description: "Falta a força para completar a avaliação.",
        });
      }
      setValues({});
      qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
    } catch (e) {
      console.error("[MobilidadeTab] falha ao salvar mobilidade", {
        name: e instanceof Error ? e.name : undefined,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        error: e,
      });
      toast.error(e instanceof Error ? e.message : "Erro ao salvar mobilidade");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bio-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-white/60 p-3">
                Mobilidade / Flexibilidade
              </th>
              <th className="text-center text-xs font-medium text-white/60 p-3 w-20">Esquerdo</th>
              <th className="text-center text-xs font-medium text-white/60 p-3 w-24">Class. E</th>
              <th className="text-center text-xs font-medium text-white/60 p-3 w-20">Direito</th>
              <th className="text-center text-xs font-medium text-white/60 p-3 w-24">Class. D</th>
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
                <tr key={metric} className="border-b border-white/5">
                  <td className="p-3">
                    <p className="text-sm text-white/90">{metric}</p>
                    {ref && (
                      <p className="text-[10px] text-white/45 mt-0.5 italic">{ref}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      className="w-16 text-center h-8 text-sm mx-auto"
                      value={v.left}
                      onChange={(e) => handleChange(metric, "left", e.target.value)}
                      placeholder="°"
                    />
                  </td>
                  <td className="p-3 text-center">
                    {lc && (
                      <span
                        className={`text-xs font-semibold ${getClassificationColor(lc as AssessmentClassification)}`}
                      >
                        {lc}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      className="w-16 text-center h-8 text-sm mx-auto"
                      value={v.right}
                      onChange={(e) => handleChange(metric, "right", e.target.value)}
                      placeholder="°"
                    />
                  </td>
                  <td className="p-3 text-center">
                    {rc && (
                      <span
                        className={`text-xs font-semibold ${getClassificationColor(rc as AssessmentClassification)}`}
                      >
                        {rc}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || preenchidos.length === 0}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" /> Salvar mobilidade
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
