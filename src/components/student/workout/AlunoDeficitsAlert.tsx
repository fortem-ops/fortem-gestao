import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { useExerciciosPorArticulacao } from "@/hooks/useExerciciosPorArticulacao";
import { gerarSugestoesAquecimento } from "@/components/avaliacoes-premium/aquecimentoSugestoes";
import { ExerciciosSugeridosList } from "@/components/avaliacoes-premium/ExerciciosSugeridosList";
import { corGradienteAssimetria } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { Button } from "@/components/ui/button";

interface Props {
  alunoId: string;
}

/**
 * Resumo informativo das assimetrias de mobilidade/flexibilidade do aluno (faixas amarela/vermelha)
 * com exercícios de aquecimento sugeridos, exibido ao prescrever um treino.
 */
export function AlunoDeficitsAlert({ alunoId }: Props) {
  const { data } = useAlunoAvaliacoesConsolidadas(alunoId);
  const { data: vinculados } = useExerciciosPorArticulacao();
  const [open, setOpen] = useState(true);

  const funcional = data?.funcional.latest ?? null;
  const sugestoes = useMemo(
    () => gerarSugestoesAquecimento(funcional?.metricas, vinculados),
    [funcional, vinculados],
  );

  if (!funcional || sugestoes.length === 0) return null;

  const dataFmt = new Date(funcional.data + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold truncate">
            Assimetrias do aluno · avaliação funcional de {dataFmt}
          </p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-700">
            {sugestoes.length}
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {sugestoes.map((s) => (
            <div key={s.metric} className="rounded-md border border-border bg-background/60 p-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: corGradienteAssimetria(s.assimetriaPct) }}
                />
                <p className="text-xs font-semibold">
                  {s.area === "mobilidade" ? "Mobilidade" : "Flexibilidade"} · {s.label}
                </p>
                <span className="ml-auto text-xs font-bold tabular-nums">{s.assimetriaPct.toFixed(0)}%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Lado {s.ladoDeficitario} deficitário ({s.chaveLabel}) · faixa {s.faixa}
              </p>
              <ExerciciosSugeridosList exercicios={s.exercicios} chaveLabel={s.chaveLabel} compact />
            </div>
          ))}
          <p className="md:col-span-2 text-[11px] text-muted-foreground">
            Sugestões informativas: inclua os exercícios nos blocos de Aquecimento conforme o julgamento profissional.
          </p>
        </div>
      )}
    </div>
  );
}
