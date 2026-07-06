import { BodyMap } from "@/components/student/assessment/funcionalV2/BodyMap";
import { AlertTriangle } from "lucide-react";
import type { FuncionalSnapshot } from "./useAlunoAvaliacoesConsolidadas";

interface Props {
  funcional: FuncionalSnapshot | null;
}

/**
 * Wrapper premium do BodyMap existente. Adiciona moldura "vidro fosco" + halo radial
 * sem alterar a geometria nem os bindings já validados.
 */
export function PremiumBodyMap({ funcional }: Props) {
  if (!funcional || (funcional.metricas.length === 0 && funcional.forca.length === 0)) {
    return (
      <div className="bio-card p-8 text-center text-white/55">
        <p className="bio-label mb-2">Mapa Corporal</p>
        <p className="text-sm">
          Nenhuma avaliação funcional registrada. Realize uma Avaliação Funcional v2
          para visualizar o mapa biomecânico premium.
        </p>
      </div>
    );
  }

  const forcaInputs = funcional.forca.map((e) => ({
    nome: e.nome,
    direito_kg: e.direito_kg,
    esquerdo_kg: e.esquerdo_kg,
  }));

  const temMetricas = funcional.metricas.some(
    (m) => m.left !== null || m.right !== null,
  );
  const temForca = funcional.forca.length > 0;
  const incompleto = !temMetricas || !temForca;
  const chipLabel = !temForca
    ? "Avaliação incompleta — força pendente"
    : !temMetricas
    ? "Avaliação incompleta — mobilidade/flexibilidade pendente"
    : null;


  return (
    <div className="bio-card overflow-hidden relative">
      {/* Glow ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 40% at 30% 10%, hsl(var(--sev-medium) / 0.16) 0%, transparent 60%), radial-gradient(50% 40% at 80% 90%, hsl(0 80% 55% / 0.10) 0%, transparent 60%)",
        }}
      />
      {incompleto && chipLabel && (
        <div className="relative px-4 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {chipLabel}
          </div>
        </div>
      )}
      <div className="relative">
        <BodyMap metrics={funcional.metricas} forcaExercises={forcaInputs} />
      </div>
    </div>
  );
}
