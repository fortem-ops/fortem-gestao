import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { corGradienteAssimetria, type ContagemAssimetrias } from "@/components/student/assessment/funcionalV2/bodyMapLogic";

interface Props {
  label: string;
  contagem: ContagemAssimetrias;
  tooltip?: string;
  /** Quando true, exibe apenas o número principal (sem tooltip e sem detalhamento por faixa). */
  simples?: boolean;
}

/**
 * Card de resumo baseado em CONTAGEM de assimetrias (sem classificação textual).
 * Destaca o total de assimetrias detectadas e o detalhe por faixa.
 */
export function DashboardCountCard({ label, contagem, tooltip, simples }: Props) {
  const { alta, moderada, baixa, total } = contagem;
  const cor = corGradienteAssimetria(alta > 0 ? 25 : moderada > 0 ? 14 : 4);
  const showTooltip = !simples && !!tooltip;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bio-card bio-card-hover p-4 relative overflow-hidden ${showTooltip ? "cursor-help" : ""}`}
    >
      {showTooltip && (
        <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-[hsl(var(--bio-ink-faint))]" aria-hidden />
      )}
      <p className="bio-label">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl bio-heading" style={{ color: total > 0 ? cor : undefined }}>
          {total > 0 ? alta + moderada : "—"}
        </span>
        <span className="text-[11px] text-[hsl(var(--bio-ink-faint))]">
          {total > 0 ? "assimetria(s)" : "sem dado"}
        </span>
      </div>
      {!simples && (
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold">
          <span style={{ color: corGradienteAssimetria(25) }}>{alta} &gt;20%</span>
          <span className="text-[hsl(var(--bio-ink-faint))]">·</span>
          <span style={{ color: corGradienteAssimetria(14) }}>{moderada} 10–20%</span>
          <span className="text-[hsl(var(--bio-ink-faint))]">·</span>
          <span style={{ color: corGradienteAssimetria(4) }}>{baixa} &lt;10%</span>
        </div>
      )}

    </motion.div>
  );

  if (!showTooltip) return card;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{card}</div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed bg-[hsl(var(--bio-surface))] border-[hsl(var(--bio-line))] text-[hsl(var(--bio-ink))]"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Card de Risco de Lesão: 3 contadores por faixa de assimetria. */
export function DashboardRiscoCard({ contagem }: { contagem: ContagemAssimetrias }) {
  const faixas = [
    { titulo: "> 20%", valor: contagem.alta, cor: corGradienteAssimetria(25) },
    { titulo: "10–20%", valor: contagem.moderada, cor: corGradienteAssimetria(14) },
    { titulo: "< 10%", valor: contagem.baixa, cor: corGradienteAssimetria(4) },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bio-card bio-card-hover p-4 col-span-2"
    >
      <p className="bio-label">Risco de Lesão · assimetrias</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {faixas.map((f) => (
          <div key={f.titulo} className="text-center">
            <p className="text-2xl bio-heading" style={{ color: f.cor }}>{f.valor}</p>
            <p className="text-[10px] font-semibold tracking-wide text-[hsl(var(--bio-ink-faint))]">{f.titulo}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
