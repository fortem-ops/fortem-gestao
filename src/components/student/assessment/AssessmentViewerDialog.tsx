import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { exportAssessmentPDF } from "./exportAssessmentPDF";
import { BodyDiagram } from "./BodyDiagram";
import { ExperimentalAssessment, renderAnswerSummary } from "./ExperimentalAssessment";
import { fetchExperimentalSchema, migrateLegacyDados, type ExperimentalRecordDados } from "./experimentalTemplate";
import { useQuery as useTplQuery } from "@tanstack/react-query";
import { AvaliacaoAnexos } from "./AvaliacaoAnexos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avaliacao: Tables<"avaliacoes"> | null;
  student: Tables<"alunos">;
}

interface FuncMetric {
  metric: string;
  left: number | null;
  right: number | null;
  leftClass: AssessmentClassification | null;
  rightClass: AssessmentClassification | null;
}

export function AssessmentViewerDialog({ open, onOpenChange, avaliacao, student }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const isFuncional = avaliacao?.tipo === "funcional";
  const isComposicao = avaliacao?.tipo === "composicao_corporal";
  const isExperimental = avaliacao?.tipo === "experimental";

  const { data: canEdit } = useQuery({
    queryKey: ["is-coord-or-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const { data: funcional, isLoading } = useQuery({
    queryKey: ["avaliacao-funcional", avaliacao?.id],
    enabled: !!avaliacao && isFuncional,
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacao_funcional")
        .select("*")
        .eq("avaliacao_id", avaliacao!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!avaliacao) return null;

  const dados = (avaliacao.dados as Record<string, unknown>) || {};
  const metricasFromJson = (dados.metricas as FuncMetric[] | undefined) || [];
  const expDados: ExperimentalRecordDados | null = isExperimental ? migrateLegacyDados(dados) : null;

  const { data: expSchema } = useTplQuery({
    queryKey: ["avaliacao-template", "experimental"],
    queryFn: fetchExperimentalSchema,
    enabled: isExperimental,
  });

  async function handleDelete() {
    if (!avaliacao) return;
    try {
      const { error } = await supabase.from("avaliacoes").delete().eq("id", avaliacao.id);
      if (error) throw error;
      toast.success("Avaliação excluída");
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-aluno", student.id] });
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-global", student.id] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  const handleExport = () => {
    if (isFuncional) {
      const rows = metricasFromJson.map(m => ({
        label: m.metric,
        left: m.left !== null ? `${m.left}°` : "—",
        leftClass: m.leftClass || "—",
        right: m.right !== null ? `${m.right}°` : "—",
        rightClass: m.rightClass || "—",
      }));
      exportAssessmentPDF({
        student,
        tipo: "Avaliação Funcional",
        rows,
        notes: avaliacao.observacoes || undefined,
      });
    } else if (isComposicao) {
      const dobras = (dados.dobras as Record<string, string>) || {};
      const rows = [
        { label: "Sexo", left: dados.sexo === 'M' ? 'Masculino' : 'Feminino', leftClass: '', right: '', rightClass: '' },
        { label: "Idade", left: `${dados.idade} anos`, leftClass: '', right: '', rightClass: '' },
        { label: "Peso", left: `${dados.peso} kg`, leftClass: '', right: '', rightClass: '' },
        { label: "Altura", left: `${dados.altura} cm`, leftClass: '', right: '', rightClass: '' },
        ...Object.keys(dobras).map(d => ({ label: `Dobra ${d}`, left: `${dobras[d]} mm`, leftClass: '', right: '', rightClass: '' })),
        { label: "Σ 7 Dobras", left: `${(dados.sigma7 as number)?.toFixed(1)} mm`, leftClass: '', right: '', rightClass: '' },
        { label: "Densidade Corporal", left: (dados.densidade as number)?.toFixed(4) || '—', leftClass: '', right: '', rightClass: '' },
        { label: "% Gordura", left: `${(dados.percentual_gordura as number)?.toFixed(1)}%`, leftClass: String(dados.classificacao || ''), right: '', rightClass: '' },
        ...(dados.imc != null ? [{ label: "IMC", left: (dados.imc as number).toFixed(1), leftClass: '', right: '', rightClass: '' }] : []),
        ...(dados.massa_magra != null ? [{ label: "Massa Magra", left: `${(dados.massa_magra as number).toFixed(1)} kg`, leftClass: '', right: '', rightClass: '' }] : []),
        ...(dados.massa_gorda != null ? [{ label: "Massa Gorda", left: `${(dados.massa_gorda as number).toFixed(1)} kg`, leftClass: '', right: '', rightClass: '' }] : []),
      ];
      exportAssessmentPDF({
        student,
        tipo: "Composição Corporal — Pollock 7 Dobras",
        rows,
        notes: avaliacao.observacoes || undefined,
      });
    }
  };

  // Build classifications map for body diagram (functional only)
  const diagramClassifications: Record<string, { left: AssessmentClassification | null; right: AssessmentClassification | null }> = {};
  metricasFromJson.forEach(m => {
    diagramClassifications[m.metric] = { left: m.leftClass, right: m.rightClass };
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize flex items-center gap-2 flex-wrap">
            {avaliacao.tipo.replace(/_/g, ' ')} — {format(new Date(avaliacao.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {isExperimental && expDados && (
              <Badge variant="outline" className={expDados.status === "finalizado" ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
                {expDados.status === "finalizado" ? "Finalizada" : "Rascunho"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isExperimental ? (
          editing ? (
            <ExperimentalAssessment student={student} avaliacaoId={avaliacao.id} />
          ) : (
            <ExperimentalView dados={expDados!} schema={expSchema} />
          )
        ) : isLoading && isFuncional ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {isFuncional && metricasFromJson.length > 0 && (
              <>
                <div className="glass-card rounded-lg p-4 flex flex-col items-center">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Mapa Corporal</h4>
                  <BodyDiagram classifications={diagramClassifications} />
                </div>

                <div className="glass-card rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Métrica</th>
                        <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Esquerdo</th>
                        <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. E</th>
                        <th className="text-center text-xs font-medium text-muted-foreground p-3 w-20">Direito</th>
                        <th className="text-center text-xs font-medium text-muted-foreground p-3 w-24">Class. D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricasFromJson.map(m => (
                        <tr key={m.metric} className="border-b border-border/50">
                          <td className="p-3 text-foreground">{m.metric}</td>
                          <td className="p-3 text-center">{m.left !== null ? `${m.left}°` : '—'}</td>
                          <td className="p-3 text-center">{m.leftClass && <span className={`text-xs font-semibold ${getClassificationColor(m.leftClass)}`}>{m.leftClass}</span>}</td>
                          <td className="p-3 text-center">{m.right !== null ? `${m.right}°` : '—'}</td>
                          <td className="p-3 text-center">{m.rightClass && <span className={`text-xs font-semibold ${getClassificationColor(m.rightClass)}`}>{m.rightClass}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {funcional?.observacoes && !avaliacao.observacoes && (
                  <div className="glass-card rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Observações</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funcional.observacoes}</p>
                  </div>
                )}
              </>
            )}

            {isComposicao && (
              <div className="glass-card rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Item label="Sexo" value={dados.sexo === 'M' ? 'Masculino' : 'Feminino'} />
                  <Item label="Idade" value={`${dados.idade} anos`} />
                  <Item label="Peso" value={`${dados.peso} kg`} />
                  <Item label="Altura" value={`${dados.altura} cm`} />
                  <Item label="Σ 7 Dobras" value={`${(dados.sigma7 as number)?.toFixed(1)} mm`} />
                  <Item label="Densidade" value={(dados.densidade as number)?.toFixed(4)} />
                  <Item label="% Gordura" value={`${(dados.percentual_gordura as number)?.toFixed(1)}%`} highlight={String(dados.classificacao || '')} />
                  {dados.imc != null && <Item label="IMC" value={(dados.imc as number).toFixed(1)} />}
                  {dados.massa_magra != null && <Item label="Massa Magra" value={`${(dados.massa_magra as number).toFixed(1)} kg`} />}
                  {dados.massa_gorda != null && <Item label="Massa Gorda" value={`${(dados.massa_gorda as number).toFixed(1)} kg`} />}
                </div>
              </div>
            )}

            {avaliacao.observacoes && (
              <div className="glass-card rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Observações</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{avaliacao.observacoes}</p>
              </div>
            )}

            {!isFuncional && !isComposicao && !isExperimental && (
              <div className="glass-card rounded-lg p-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(dados, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {isExperimental && canEdit && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
          )}
          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir avaliação</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Deseja realmente excluir esta avaliação?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {(isFuncional || isComposicao) && (
            <Button onClick={handleExport}><FileDown className="w-4 h-4 mr-2" /> Exportar PDF</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-secondary/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground">{value}</p>
      {highlight && <p className="text-xs font-semibold text-success mt-0.5">{highlight}</p>}
    </div>
  );
}

function ExperimentalView({ dados, schema }: { dados: ExperimentalRecordDados; schema?: { sections: { id: string; title: string; questions: { id: string; label: string; type: string; detalheLabel?: string; labelSim?: string; labelNao?: string; options?: { value: string; label: string }[] }[] }[] } }) {
  if (!schema) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  return (
    <div className="space-y-4">
      {schema.sections.map((sec) => (
        <section key={sec.id} className="glass-card rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
          {sec.questions.map((q) => {
            const summary = renderAnswerSummary(q as never, dados.answers[q.id]);
            return <Row key={q.id} label={q.label} value={summary.value} detail={summary.detail} />;
          })}
        </section>
      ))}
    </div>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">
        {value}
        {detail ? <span className="text-muted-foreground"> — {detail}</span> : null}
      </span>
    </div>
  );
}
