/**
 * Helpers de Tolerância CLT do módulo Ponto.
 * Regra: até 5 min por marcação E soma diária ≤ 10 min são ignorados.
 * Caso contrário, todas as divergências contam para desconto / hora extra.
 */

export type StatusPonto =
  | "dentro_tolerancia"
  | "divergencia_leve"
  | "divergencia_considerada"
  | "banco_negativo"
  | "hora_extra"
  | "jornada_incompleta"
  | "falta_marcacao"
  | "em_analise";

export const STATUS_PONTO_LABEL: Record<StatusPonto, string> = {
  dentro_tolerancia: "Dentro da tolerância",
  divergencia_leve: "Divergência leve",
  divergencia_considerada: "Divergência considerada",
  banco_negativo: "Banco negativo",
  hora_extra: "Hora extra",
  jornada_incompleta: "Jornada incompleta",
  falta_marcacao: "Falta de marcação",
  em_analise: "Em análise",
};

/** Classe Tailwind para Badge — usa apenas tokens semânticos. */
export const STATUS_PONTO_CLASS: Record<StatusPonto, string> = {
  dentro_tolerancia: "bg-success/15 text-success border-success/30",
  divergencia_leve: "bg-warning/15 text-warning border-warning/30",
  divergencia_considerada: "bg-destructive/15 text-destructive border-destructive/30",
  banco_negativo: "bg-destructive/15 text-destructive border-destructive/30",
  hora_extra: "bg-success/15 text-success border-success/30",
  jornada_incompleta: "bg-warning/15 text-warning border-warning/30",
  falta_marcacao: "bg-destructive/15 text-destructive border-destructive/30",
  em_analise: "bg-info/15 text-info border-info/30",
};

export interface JornadaTolerancia {
  divergencia_entrada_min?: number | null;
  divergencia_saida_min?: number | null;
  divergencia_intervalo_min?: number | null;
  divergencia_total_dia?: number | null;
  minutos_tolerados?: number | null;
  minutos_considerados?: number | null;
  minutos_descontaveis?: number | null;
  minutos_extras_validos?: number | null;
  tolerancia_excedida?: boolean | null;
  status_ponto?: StatusPonto | null;
  prev_entrada?: string | null;
  prev_saida?: string | null;
  prev_intervalo_min?: number | null;
}

export interface ToleranciaConfig {
  tolerancia_marcacao_min: number;
  tolerancia_diaria_min: number;
}

export const DEFAULT_TOLERANCIA: ToleranciaConfig = {
  tolerancia_marcacao_min: 5,
  tolerancia_diaria_min: 10,
};

/** Diferença em minutos arredondada (positivo = depois/maior, negativo = antes/menor). */
export function calculateTolerance(diff: number, cfg = DEFAULT_TOLERANCIA): "ignorada" | "considerada" {
  return Math.abs(diff) > cfg.tolerancia_marcacao_min ? "considerada" : "ignorada";
}

/** Soma absoluta das divergências do dia. */
export function calculateDailyDeviation(j: JornadaTolerancia): number {
  return Math.abs(j.divergencia_entrada_min ?? 0)
    + Math.abs(j.divergencia_saida_min ?? 0)
    + Math.abs(j.divergencia_intervalo_min ?? 0);
}

/** Verifica se as divergências do dia excedem a regra CLT. */
export function validateLegalTolerance(j: JornadaTolerancia, cfg = DEFAULT_TOLERANCIA): boolean {
  const max = Math.max(
    Math.abs(j.divergencia_entrada_min ?? 0),
    Math.abs(j.divergencia_saida_min ?? 0),
    Math.abs(j.divergencia_intervalo_min ?? 0),
  );
  return max > cfg.tolerancia_marcacao_min || calculateDailyDeviation(j) > cfg.tolerancia_diaria_min;
}

/** Saldo do dia em minutos: extras − descontos. */
export function calculateBankHours(j: JornadaTolerancia): number {
  return (j.minutos_extras_validos ?? 0) - (j.minutos_descontaveis ?? 0);
}

/** Cor de divergência por marcação para a UI: verde extra, vermelho desconto, amarelo tolerada, neutro zero. */
export function divergenciaTone(diff: number | null | undefined, excedida: boolean | null | undefined): "neutral" | "tolerada" | "extra" | "desconto" {
  if (diff == null || diff === 0) return "neutral";
  if (!excedida) return "tolerada";
  return diff > 0 ? "desconto" : "extra"; // entrada atrasada / intervalo maior = desconto; antes = extra (regra padrão para entrada/intervalo)
}

export function formatDivergencia(diff: number | null | undefined): string {
  if (diff == null || diff === 0) return "0 min";
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${Math.abs(diff)} min`;
}
