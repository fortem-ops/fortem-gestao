export type Frequencia = "1x" | "2x" | "3x" | "livre";

export const FREQUENCIAS: Frequencia[] = ["1x", "2x", "3x", "livre"];
export const PERIODOS = [1, 12];

export const PRESET_CORES = [
  { nome: "Cinza", cor: "#9CA3AF" },
  { nome: "Branco", cor: "#F3F4F6" },
  { nome: "Vermelho", cor: "#EF4444" },
  { nome: "Preto", cor: "#111827" },
  { nome: "Vermelho escuro", cor: "#7F1D1D" },
  { nome: "Roxo", cor: "#8B5CF6" },
  { nome: "Azul", cor: "#3B82F6" },
  { nome: "Verde", cor: "#22C55E" },
];

export const PLANOS_SUGERIDOS = ["Start", "Start+", "Power", "Pro", "Max", "Gympass/Wellhub", "Total Pass"];
export const ATIVIDADES_SUGERIDAS = ["Nutrição", "Reabilitação", "Avaliação Funcional"];

/**
 * Calcula créditos automáticos. Retorna { quantidade, ilimitado }.
 * 1x mensal=4/anual=52, 2x=8/104, 3x=12/156, livre=ilimitado.
 */
export function calcularCreditos(periodoMeses: number, freq: Frequencia): { quantidade: number | null; ilimitado: boolean } {
  if (freq === "livre") return { quantidade: null, ilimitado: true };
  const semanas = periodoMeses === 1 ? 4 : periodoMeses * (52 / 12);
  const mult = freq === "1x" ? 1 : freq === "2x" ? 2 : 3;
  return { quantidade: Math.round(semanas * mult), ilimitado: false };
}

export function formatBRL(v: number | null | undefined): string {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
