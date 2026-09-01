/**
 * Dados estáticos do funil público /planos (Fortem Plan Builder).
 * Tudo hardcoded — nenhuma tabela ou edge function envolvida.
 */

export type FrequenciaPlano = "1x" | "2x" | "3x" | "livre";
export type PlanoId = "start" | "start_plus" | "power" | "pro" | "max";

/** Adicional mensal para trocar fidelidade 12 meses por recorrência mensal. */
export const RECORRENCIA_EXTRA = 30;

/** WhatsApp comercial da Fortem (somente dígitos, com DDI). */
export const WHATSAPP_NUMERO = "5135199451";

export interface FrequenciaDef {
  id: FrequenciaPlano;
  label: string;
  descricao: string;
  destaque?: boolean;
}

export const FREQUENCIAS: FrequenciaDef[] = [
  { id: "1x", label: "1x por semana", descricao: "Para começar com constância." },
  { id: "2x", label: "2x por semana", descricao: "Equilíbrio entre rotina e resultado." },
  { id: "3x", label: "3x por semana", descricao: "O mais escolhido pelos alunos.", destaque: true },
  { id: "livre", label: "Livre", descricao: "Treine quantas vezes quiser." },
];

export interface PlanoDef {
  id: PlanoId;
  nome: string;
  tag: string | null;
  descricao: string;
  beneficios: string[];
  /** START já é recorrência mensal nativa — sem toggle e sem adicional. */
  recorrenciaNativa?: boolean;
  highlighted?: boolean;
}

export const PLANOS: PlanoDef[] = [
  {
    id: "start",
    nome: "START",
    tag: null,
    descricao: "Plano ideal para experimentar.",
    recorrenciaNativa: true,
    beneficios: [
      "Recorrência Mensal",
      "Plano de treinamento personalizado",
      "20% OFF avaliação funcional",
      "Sem fidelidade",
    ],
  },
  {
    id: "start_plus",
    nome: "START+",
    tag: "Básico",
    descricao: "Compromisso com a tua saúde.",
    beneficios: [
      "Plano de treinamento personalizado",
      "1 avaliação funcional e de força",
      "Bloqueio de até 10 dias",
      "20% OFF reavaliação",
    ],
  },
  {
    id: "power",
    nome: "POWER",
    tag: '💪 Não é "só" treinar...',
    descricao: "O começo do teu acompanhamento multidisciplinar",
    beneficios: [
      "Plano de treinamento personalizado",
      "1 avaliação funcional e de força",
      "2 consultas com nutri ou fisio",
      "Horários fixos",
      "Bloqueio até 15 dias",
      "30% OFF reavaliação",
      "25% OFF reposição de treinos",
    ],
  },
  {
    id: "pro",
    nome: "PRO",
    tag: "⭐ Recomendamos",
    descricao: "Mais benefícios no teu plano multidisciplinar",
    highlighted: true,
    beneficios: [
      "Plano de treinamento personalizado",
      "2 avaliações funcionais e de força",
      "4 consultas nutri ou fisio",
      "Horários fixos",
      "Bloqueio até 20 dias",
      "10% OFF novas consultas",
      "40% OFF reavaliação",
      "50% OFF reposição",
      "Treinos de sábado FREE",
      "Open bar nos happy hours",
    ],
  },
  {
    id: "max",
    nome: "MAX",
    tag: "👑 Plano Premium",
    descricao: "A experiência Fortem completa.",
    beneficios: [
      "Plano de treinamento personalizado",
      "3 avaliações funcionais e de força",
      "5 consultas com nutri e fisio",
      "Horários fixos",
      "Bloqueio até 30 dias",
      "25% OFF consultas extras",
      "50% OFF reavaliação",
      "Reposição total de treinos",
      "Treinos de sábado FREE",
      "Open bar happy hours",
    ],
  },
];

/** Preço mensal (R$) por frequência × plano. */
export const PRECOS: Record<FrequenciaPlano, Record<PlanoId, number>> = {
  "1x": { start: 399, start_plus: 369, power: 419, pro: 469, max: 569 },
  "2x": { start: 499, start_plus: 459, power: 509, pro: 559, max: 659 },
  "3x": { start: 599, start_plus: 559, power: 609, pro: 659, max: 759 },
  livre: { start: 699, start_plus: 659, power: 709, pro: 759, max: 859 },
};

/** Upsell de frequência: sugere adicionar mais um treino semanal. */
export const PROXIMA_FREQUENCIA: Partial<Record<FrequenciaPlano, FrequenciaPlano>> = {
  "1x": "2x",
  "2x": "3x",
  "3x": "livre",
};

/** Upgrade inteligente de plano (sem upgrade a partir do MAX). */
export const PROXIMO_PLANO: Partial<Record<PlanoId, PlanoId>> = {
  start: "power",
  start_plus: "power",
  power: "pro",
  pro: "max",
};

export function getPlano(id: PlanoId): PlanoDef {
  return PLANOS.find((p) => p.id === id)!;
}

export function getFrequencia(id: FrequenciaPlano): FrequenciaDef {
  return FREQUENCIAS.find((f) => f.id === id)!;
}

export function precoDe(freq: FrequenciaPlano, plano: PlanoId): number {
  return PRECOS[freq][plano];
}

/** Menor preço da linha da frequência — usado no "a partir de". */
export function precoMinimoDaFrequencia(freq: FrequenciaPlano): number {
  return Math.min(...Object.values(PRECOS[freq]));
}

/** Preço final considerando o adicional de recorrência mensal. */
export function precoFinal(freq: FrequenciaPlano, plano: PlanoId, recorrencia: boolean): number {
  const base = precoDe(freq, plano);
  return recorrencia && !getPlano(plano).recorrenciaNativa ? base + RECORRENCIA_EXTRA : base;
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
