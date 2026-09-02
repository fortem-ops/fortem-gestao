import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, Loader2, Plus, X, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ALL_FUNCTIONAL_METRICS,
  percentilMobilidade,
  getMetricDisplayLabel,
  type MetricInput,
  type MobilidadeReferenceData,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";

import { classifyAngle } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { getFuncionalV2DefaultProtocoloId } from "@/lib/kinologyImport";
import { AssessmentDateField, todayISO } from "../AssessmentDateField";
import type { FuncionalSnapshot } from "../useAlunoAvaliacoesConsolidadas";

interface Props {
  alunoId: string;
  latest?: FuncionalSnapshot | null;
  history?: FuncionalSnapshot[];
  aluno?: { sexo: string | null } | null;
  referenceData?: MobilidadeReferenceData;
  initialFormOpen?: boolean;
  readOnly?: boolean;
}

interface MobilidadeRow {
  id: string;
  data: string;
  dados: Record<string, unknown>;
  metricas: MetricInput[];
}

/**
 * Aba de entrada manual de mobilidade/flexibilidade na tela Avaliações Premium.
 * Espelha a lógica do Kinology (força): tenta mesclar em uma avaliação
 * funcional_v2 existente NA MESMA DATA que já tenha força mas ainda não tem
 * métricas. Caso contrário, cria uma nova linha só com mobilidade.
 */

function statsFromArray(arr: number[]): { mean: number; sigma: number } {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, sigma: Math.sqrt(variance) || 1 };
}

interface CurveMarker {
  id: string;
  value: number;
  percentile: number;
  color: string;
}

function PercentileCurveCard({
  metric,
  mean,
  sigma,
  unit,
  markers,
}: {
  metric: string;
  mean: number;
  sigma: number;
  unit: string;
  markers: CurveMarker[];
}) {
  const vMin = Math.max(0, mean - 3 * sigma);
  const vMax = mean + 3 * sigma;
  const xPad = 10;
  const xW = 260;
  const baseY = 96;
  const topY = 14;
  const xOf = (v: number) => xPad + ((v - vMin) / (vMax - vMin || 1)) * xW;
  const gauss = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sigma * sigma));
  const n = 48;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const v = vMin + ((vMax - vMin) * i) / n;
    return [xOf(v), baseY - gauss(v) * (baseY - topY)] as [number, number];
  });
  const fillPath =
    `M ${pts[0][0].toFixed(1)},${baseY} ` +
    pts.map((p) => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1][0].toFixed(1)},${baseY} Z`;
  const linePath = "M " + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");
  const xMean = xOf(mean);

  return (
    <div className="rounded-lg border border-[hsl(var(--bio-line))] p-3">
      <p className="text-xs font-medium text-[hsl(var(--bio-ink))] mb-1">{metric}</p>
      <svg viewBox={`0 0 ${xPad * 2 + xW} 116`} width="100%" height={100}>
        <path d={fillPath} fill="hsl(210 70% 92%)" />
        <path d={linePath} fill="none" stroke="hsl(210 60% 60%)" strokeWidth="1.5" />
        <line x1={xMean} x2={xMean} y1={topY} y2={baseY} stroke="hsl(220 12% 55%)" strokeDasharray="3 3" />
        <line x1={xPad} x2={xPad + xW} y1={baseY} y2={baseY} stroke="hsl(220 14% 80%)" />
        {markers.map((m) => {
          const x = xOf(m.value);
          const y = baseY - gauss(m.value) * (baseY - topY);
          return (
            <g key={m.id}>
              <line x1={x} x2={x} y1={topY} y2={baseY} stroke={m.color} strokeWidth="2" />
              <circle cx={x} cy={y} r="4" fill={m.color} />
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-[hsl(var(--bio-ink-muted))]">média {mean.toFixed(1)}{unit}</span>
        <div className="flex gap-2">
          {markers.map((m) => (
            <span key={m.id} className="text-[10px] font-medium" style={{ color: m.color }}>
              {m.id} {m.value}{unit} · P{m.percentile}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobilidadeTab({ alunoId, aluno, referenceData, initialFormOpen, readOnly = false }: Props) {
  const sexoRpc: "M" | "F" | undefined = aluno?.sexo?.toLowerCase().startsWith("f")
    ? "F"
    : aluno?.sexo?.toLowerCase().startsWith("m")
    ? "M"
    : undefined;
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["mobilidade-historico", alunoId],
    enabled: !!alunoId,
    queryFn: async (): Promise<MobilidadeRow[]> => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("id, data, dados")
        .eq("aluno_id", alunoId)
        .eq("tipo", "funcional_v2")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row) => {
          const dados = (row.dados as Record<string, unknown>) || {};
          const metricas = (dados.metricas as MetricInput[] | undefined) ?? [];
          return { id: row.id, data: row.data as string, dados, metricas };
        })
        .filter((r) => r.metricas.length > 0);
    },
  });

  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (historico.length > 0 && !historico.some((h) => h.id === selectedId)) {
      setSelectedId(historico[0].id);
    }
  }, [historico, selectedId]);

  const selecionada = useMemo(
    () => historico.find((h) => h.id === selectedId) ?? null,
    [historico, selectedId],
  );

  const curvasData = useMemo(() => {
    if (!selecionada || !sexoRpc || !referenceData) return [];
    return selecionada.metricas
      .map((m) => {
        const arr = referenceData[m.metric]?.[sexoRpc];
        if (!arr || arr.length < 15) return null;
        const { mean, sigma } = statsFromArray(arr);
        const markers: CurveMarker[] = [];
        if (m.left !== null) {
          const pct = percentilMobilidade(m.metric, sexoRpc, m.left, referenceData);
          if (pct !== null) markers.push({ id: "E", value: m.left, percentile: pct, color: "#378ADD" });
        }
        if (m.right !== null) {
          const pct = percentilMobilidade(m.metric, sexoRpc, m.right, referenceData);
          if (pct !== null) markers.push({ id: "D", value: m.right, percentile: pct, color: "#D85A30" });
        }
        if (markers.length === 0) return null;
        return { metric: m.metric, mean, sigma, unit: "°", markers };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [selecionada, sexoRpc, referenceData]);

  const [formOpen, setFormOpen] = useState(initialFormOpen ?? false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>({});
  const [data, setData] = useState<string>(todayISO());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  function abrirNova() {
    setEditandoId(null);
    setValues({});
    setData(todayISO());
    setFormOpen(true);
  }

  function abrirEdicao(row: MobilidadeRow) {
    const v: Record<string, { left: string; right: string }> = {};
    row.metricas.forEach((m) => {
      v[m.metric] = {
        left: m.left !== null && m.left !== undefined ? String(m.left) : "",
        right: m.right !== null && m.right !== undefined ? String(m.right) : "",
      };
    });
    setValues(v);
    setData(row.data);
    setEditandoId(row.id);
    setFormOpen(true);
  }

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["mobilidade-historico", alunoId] });
    qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
    qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
    qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
  }

  /**
   * Procura linha funcional_v2 com força já registrada, sem métricas,
   * NA MESMA DATA que está sendo lançada. O filtro por data evita mesclar
   * lançamentos retroativos na avaliação errada.
   */
  async function findFuncionalV2AguardandoMobilidade(dataISO: string) {
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id, data, dados")
      .eq("aluno_id", alunoId)
      .eq("tipo", "funcional_v2")
      .eq("data", dataISO)
      .order("created_at", { ascending: false })
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
      const dataFinal = data || todayISO();

      if (editandoId) {
        const alvo = historico.find((h) => h.id === editandoId);
        const novosDados = { ...(alvo?.dados ?? {}), metricas: rows };
        const { error } = await supabase
          .from("avaliacoes")
          .update({ dados: novosDados, data: dataFinal } as never)
          .eq("id", editandoId);
        if (error) throw error;
        toast.success("Avaliação de mobilidade atualizada");
      } else {
        const pendente = await findFuncionalV2AguardandoMobilidade(dataFinal);
        if (pendente) {
          const novosDados = { ...pendente.dados, metricas: rows };
          const { error } = await supabase
            .from("avaliacoes")
            .update({ dados: novosDados } as never)
            .eq("id", pendente.id);
          if (error) throw error;
          toast.success("Mobilidade mesclada com sucesso", {
            description: `${preenchidos.length} métrica(s) integradas à avaliação da mesma data.`,
          });
        } else {
          const protocoloId = await getFuncionalV2DefaultProtocoloId();
          if (!protocoloId) throw new Error("Protocolo padrão de funcional_v2 não encontrado");
          const { error } = await supabase.from("avaliacoes").insert({
            aluno_id: alunoId,
            avaliador_id: user.id,
            tipo: "funcional_v2",
            protocolo_id: protocoloId,
            data: dataFinal,
            dados: { metricas: rows, forca: null },
          } as never);
          if (error) throw error;
          toast.success("Mobilidade registrada", {
            description: "Falta a força para completar a avaliação.",
          });
        }
      }

      setValues({});
      setData(todayISO());
      setEditandoId(null);
      setFormOpen(false);
      invalidar();
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

  async function handleDelete() {
    if (!selecionada) return;
    setDeleting(true);
    try {
      const temForca = Array.isArray(
        (selecionada.dados.forca as { exercicios?: unknown[] } | null)?.exercicios,
      )
        ? ((selecionada.dados.forca as { exercicios?: unknown[] }).exercicios?.length ?? 0) > 0
        : false;

      if (temForca) {
        // Preserva a força: remove só as métricas de mobilidade.
        const novosDados = { ...selecionada.dados, metricas: [] };
        const { error } = await supabase
          .from("avaliacoes")
          .update({ dados: novosDados } as never)
          .eq("id", selecionada.id);
        if (error) throw error;
        toast.success("Mobilidade removida (força preservada)");
      } else {
        const { error } = await supabase.from("avaliacoes").delete().eq("id", selecionada.id);
        if (error) throw error;
        toast.success("Avaliação de mobilidade excluída");
      }
      setConfirmDelete(false);
      setSelectedId("");
      invalidar();
    } catch (e) {
      console.error("[MobilidadeTab] falha ao excluir mobilidade", e);
      toast.error(e instanceof Error ? e.message : "Erro ao excluir avaliação");
    } finally {
      setDeleting(false);
    }
  }

  /** Bloco de formulário (novo lançamento ou edição). */
  function MobilidadeForm() {
    if (!formOpen) {
      return (
        <div className="flex justify-end">
          <Button onClick={abrirNova}>
            <Plus className="w-4 h-4 mr-2" /> Nova avaliação de mobilidade
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="bio-card p-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <AssessmentDateField
              theme="light"
              value={data}
              onChange={setData}
              helperText={
                editandoId
                  ? "Editando uma avaliação existente — alterar a data move o registro para a nova data."
                  : "Usada para localizar/criar a avaliação. A mesclagem com a força só acontece se a data for exatamente a mesma."
              }
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFormOpen(false);
              setEditandoId(null);
              setValues({});
            }}
          >
            <X className="w-4 h-4 mr-2" /> Cancelar
          </Button>
        </div>
        <div className="bio-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--bio-line))]">
                <th className="text-left text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3">
                  Mobilidade / Flexibilidade
                </th>
                <th className="text-center text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3 w-24">Esquerdo</th>
                <th className="text-center text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3 w-24">Direito</th>
              </tr>
            </thead>
            <tbody>
              {ALL_FUNCTIONAL_METRICS.map((metric) => {
                const v = values[metric] || { left: "", right: "" };
                return (
                  <tr key={metric} className="border-b border-[hsl(var(--bio-line))]">
                    <td className="p-3">
                      <p className="text-sm text-[hsl(var(--bio-ink))]">{getMetricDisplayLabel(metric)}</p>
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
                    <td className="p-3">
                      <Input
                        type="number"
                        className="w-16 text-center h-8 text-sm mx-auto"
                        value={v.right}
                        onChange={(e) => handleChange(metric, "right", e.target.value)}
                        placeholder="°"
                      />
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
                <Save className="w-4 h-4 mr-2" /> {editandoId ? "Salvar alterações" : "Salvar mobilidade"}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  /** Bloco de histórico: avaliações anteriores com os valores lançados. */
  function MobilidadeHistorico() {
    if (isLoading) {
      return (
        <div className="bio-card p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[hsl(var(--bio-ink-muted))]" />
        </div>
      );
    }
    if (!selecionada) {
      return (
        <div className="bio-card p-8 text-center">
          <p className="text-sm text-[hsl(var(--bio-ink-muted))]">
            Nenhuma avaliação de mobilidade/flexibilidade registrada para este aluno.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="bio-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(var(--bio-line))] flex flex-wrap items-center justify-between gap-3">
            <h3 className="bio-heading text-base">Histórico · Mobilidade / Flexibilidade</h3>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-9 w-[190px] bg-[hsl(var(--bio-surface-2))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]">
                  <SelectValue placeholder="Selecione a data" />
                </SelectTrigger>
                <SelectContent>
                  {historico.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {format(parseISO(h.data), "dd/MM/yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!readOnly && (
                <>
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(selecionada)}>
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                </>
              )}
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--bio-line))]">
                <th className="text-left text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3">Métrica</th>
                <th className="text-center text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3 w-24">Esquerdo</th>
                <th className="text-center text-xs font-medium text-[hsl(var(--bio-ink-muted))] p-3 w-24">Direito</th>
              </tr>
            </thead>
            <tbody>
              {selecionada.metricas.map((m) => (
                <tr key={m.metric} className="border-b border-[hsl(var(--bio-line))]">
                  <td className="p-3 text-sm text-[hsl(var(--bio-ink))]">{getMetricDisplayLabel(m.metric)}</td>
                  <td className="p-3 text-center text-sm text-[hsl(var(--bio-ink))]">
                    {m.left !== null ? `${m.left}°` : "—"}
                  </td>
                  <td className="p-3 text-center text-sm text-[hsl(var(--bio-ink))]">
                    {m.right !== null ? `${m.right}°` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {curvasData.length > 0 && (
          <div className="bio-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="bio-heading text-base">Distribuição vs. base Fortem</h3>
              <span className="bio-label">{sexoRpc === "F" ? "Mulheres avaliadas" : "Homens avaliados"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {curvasData.map((c) => (
                <PercentileCurveCard
                  key={c.metric}
                  metric={getMetricDisplayLabel(c.metric).replace("Mobilidade ", "").replace("Flexibilidade ", "")}
                  mean={c.mean}
                  sigma={c.sigma}
                  unit={c.unit}
                  markers={c.markers}
                />
              ))}
            </div>
            <p className="text-[11px] text-[hsl(var(--bio-ink-faint))] mt-3">
              Curva representa a distribuição da base Fortem (mesmo sexo). Linha tracejada = média. Pontos coloridos = valores do aluno (E azul, D laranja).
            </p>
          </div>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir avaliação de mobilidade?</AlertDialogTitle>
              <AlertDialogDescription>
                As métricas de {format(parseISO(selecionada.data), "dd/MM/yyyy")} serão removidas.
                Se a avaliação também tiver dados de força, a força é preservada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {readOnly ? <ReadOnlyHint /> : MobilidadeForm()}
      {MobilidadeHistorico()}
    </div>
  );
}

