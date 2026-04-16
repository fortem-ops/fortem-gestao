import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getClassificationColor } from "@/lib/mock-data";
import type { AssessmentClassification } from "@/lib/mock-data";
import { exportAssessmentPDF } from "./exportAssessmentPDF";
import { BodyDiagram } from "./BodyDiagram";

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
  const isFuncional = avaliacao?.tipo === "funcional";
  const isComposicao = avaliacao?.tipo === "composicao_corporal";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {avaliacao.tipo.replace(/_/g, ' ')} — {format(new Date(avaliacao.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        {isLoading && isFuncional ? (
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

            {!isFuncional && !isComposicao && (
              <div className="glass-card rounded-lg p-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(dados, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
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
