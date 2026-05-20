import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Upload, FileText, Sparkles, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { classifyAngle, assessmentReferences, getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { AvaliacaoAnexos } from "../AvaliacaoAnexos";
import { BodyMap } from "./BodyMap";
import {
  analyze,
  ALL_FUNCTIONAL_METRICS,
  classifyForca,
  FORCA_EXERCICIO_LABEL,
  type MetricInput,
  type ForcaInput,
  type ForcaExercicio,
} from "./bodyMapLogic";

interface Props {
  student: Tables<"alunos">;
  protocoloId: string | null;
  permiteUpload: boolean;
}

const FORCA_ORDER: ForcaExercicio[] = [
  "rotacao_interna", "rotacao_externa",
  "dorsiflexao", "flexao_plantar",
  "flexao_joelho", "extensao_joelho",
  "flexao_quadril", "extensao_quadril",
  "abducao_quadril", "aducao_quadril",
];

export function FuncionalV2Assessment({ student, protocoloId, permiteUpload }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Força
  const [forca, setForca] = useState<Record<ForcaExercicio, { D: string; E: string }>>(
    () => Object.fromEntries(FORCA_ORDER.map((k) => [k, { D: "", E: "" }])) as never,
  );
  const [laudoPath, setLaudoPath] = useState<string | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<ForcaExercicio>>(new Set());
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (metric: string, side: "left" | "right", val: string) =>
    setValues((p) => ({ ...p, [metric]: { ...(p[metric] || { left: "", right: "" }), [side]: val } }));

  const setForcaVal = (k: ForcaExercicio, side: "D" | "E", v: string) => {
    setForca((p) => ({ ...p, [k]: { ...p[k], [side]: v } }));
    setImportedKeys((s) => { const n = new Set(s); n.delete(k); return n; });
  };

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

  const forcaInputs: ForcaInput[] = useMemo(() =>
    FORCA_ORDER.map((nome) => {
      const v = forca[nome];
      const d = parseFloat(v.D.replace(",", "."));
      const e = parseFloat(v.E.replace(",", "."));
      return { nome, direito_kg: isNaN(d) ? null : d, esquerdo_kg: isNaN(e) ? null : e };
    }).filter((x) => x.direito_kg !== null && x.esquerdo_kg !== null),
  [forca]);

  const analysis = useMemo(() => analyze(rows, "asymmetry", forcaInputs), [rows, forcaInputs]);

  async function handlePdfUpload(file: File) {
    if (!user) { toast.error("Usuário não autenticado"); return; }
    setParsing(true);
    try {
      const path = `avaliacoes/laudos-dinamometria/${student.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("aluno-files").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      setLaudoPath(path);

      toast.loading("Lendo laudo com IA...", { id: "parse-laudo" });
      const { data, error } = await supabase.functions.invoke("parse-kinology-pdf", {
        body: { storage_path: path },
      });
      toast.dismiss("parse-laudo");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const exercicios = (data?.exercicios ?? []) as Array<{ nome: ForcaExercicio; direito_kg: number; esquerdo_kg: number }>;
      if (!exercicios.length) {
        toast.warning("Nenhum exercício reconhecido no laudo.");
        return;
      }
      setForca((p) => {
        const n = { ...p };
        for (const ex of exercicios) {
          n[ex.nome] = { D: String(ex.direito_kg), E: String(ex.esquerdo_kg) };
        }
        return n;
      });
      setImportedKeys(new Set(exercicios.map((e) => e.nome)));
      toast.success(`${exercicios.length} exercício(s) importado(s) do laudo`);
    } catch (e) {
      toast.dismiss("parse-laudo");
      toast.error(e instanceof Error ? e.message : "Erro ao processar laudo");
    } finally {
      setParsing(false);
    }
  }

  const handleSave = async () => {
    if (!user) { toast.error("Usuário não autenticado"); return; }
    const hasAny = rows.some((r) => r.left !== null || r.right !== null) || forcaInputs.length > 0;
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
            scoreForca: analysis.scoreForca,
            riskLevel: analysis.riskLevel,
            asymmetries: analysis.asymmetries,
            chains: analysis.chains.map((c) => ({ from: c.from, to: c.to, reason: c.reason })),
            forca: forcaInputs.length ? {
              laudoPath,
              importadoEm: laudoPath ? new Date().toISOString() : null,
              exercicios: forcaInputs.map((ex) => {
                const c = classifyForca(ex.direito_kg!, ex.esquerdo_kg!);
                return { ...ex, assimetria: Number(c.assimetria.toFixed(2)), classificacao: c.classification };
              }),
              scoreForca: analysis.scoreForca,
            } : null,
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
      <BodyMap metrics={rows} forcaExercises={forcaInputs} />

      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Mobilidade / Flexibilidade</th>
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

      {/* Força (Dinamometria Kinology) */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Força (Dinamometria isométrica)</h4>
            <p className="text-[11px] text-muted-foreground">Valores em kg. Importe o laudo Kinology em PDF para pré-preencher.</p>
          </div>
          <div className="flex items-center gap-2">
            {laudoPath && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                <FileText className="w-3 h-3" /> Laudo anexado
                <button onClick={() => { setLaudoPath(null); setImportedKeys(new Set()); }} className="ml-1 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfUpload(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" disabled={parsing} onClick={() => fileRef.current?.click()}>
              {parsing
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Lendo...</>
                : <><Upload className="w-3.5 h-3.5 mr-1" />Importar PDF Kinology</>}
            </Button>
          </div>
        </div>
        <table className="w-full">
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
            {FORCA_ORDER.map((k) => {
              const v = forca[k];
              const d = parseFloat(v.D.replace(",", "."));
              const e = parseFloat(v.E.replace(",", "."));
              const both = !isNaN(d) && !isNaN(e);
              const cls = both ? classifyForca(d, e) : null;
              const imported = importedKeys.has(k);
              return (
                <tr key={k} className="border-b border-border/40">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">{FORCA_EXERCICIO_LABEL[k]}</span>
                      {imported && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          <Sparkles className="w-2.5 h-2.5" /> laudo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3"><Input type="number" step="0.1" className="w-20 text-center h-8 text-sm mx-auto" value={v.D} onChange={(ev) => setForcaVal(k, "D", ev.target.value)} /></td>
                  <td className="p-3"><Input type="number" step="0.1" className="w-20 text-center h-8 text-sm mx-auto" value={v.E} onChange={(ev) => setForcaVal(k, "E", ev.target.value)} /></td>
                  <td className="p-3 text-center text-xs text-muted-foreground">{cls ? `${cls.assimetria.toFixed(1)}%` : "—"}</td>
                  <td className="p-3 text-center">
                    {cls && <span className={`text-xs font-semibold ${getClassificationColor(cls.classification)}`}>{cls.classification}</span>}
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
