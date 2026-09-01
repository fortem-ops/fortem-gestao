/**
 * Dados estáticos do funil público /planos (Fortem Plan Builder).
 * Tudo hardcoded — nenhuma tabela ou edge function envolvida.
 */

export type FrequenciaPlano = "2x" | "3x";
export type PlanoId = "padrao" | "ocioso";

/** WhatsApp comercial da Fortem (somente dígitos, com DDI). */
export const WHATSAPP_NUMERO = "5135199451";

export interface FrequenciaDef {
  id: FrequenciaPlano;
  label: string;
  descricao: string;
  destaque?: boolean;
}

export const FREQUENCIAS: FrequenciaDef[] = [
  { id: "2x", label: "2x por semana", descricao: "Equilíbrio entre rotina e resultado." },
  { id: "3x", label: "3x por semana", descricao: "O mais escolhido pelos alunos.", destaque: true },
];

/** Benefícios comuns aos dois formatos de horário. */
export const BENEFICIOS: string[] = [
  "Plano de treinamento personalizado",
  "Avaliação funcional e de força",
  "Acompanhamento multidisciplinar",
  "Horários fixos na tua agenda",
  "Bloqueio de treinos em viagens",
  "Descontos em reavaliações e reposições",
];

export interface PlanoDef {
  id: PlanoId;
  /** Sufixo do nome — o nome final é "PLANO 2X" / "PLANO 2X · HORÁRIO OCIOSO". */
  sufixo: string | null;
  tag: string | null;
  descricao: string;
  /** Faixa de horário restrita, quando houver. */
  horario: string | null;
  beneficios: string[];
  highlighted?: boolean;
}

export const PLANOS: PlanoDef[] = [
  {
    id: "padrao",
    sufixo: null,
    tag: "⭐ Horário livre",
    descricao: "Treina em qualquer horário de funcionamento.",
    horario: null,
    highlighted: true,
    beneficios: BENEFICIOS,
  },
  {
    id: "ocioso",
    sufixo: "HORÁRIO OCIOSO",
    tag: "Melhor valor",
    descricao: "Mesmos benefícios, treinando em horário reduzido.",
    horario: "Das 9:00 às 16:00",
    beneficios: BENEFICIOS,
  },
];

/** Preço mensal (R$) por frequência × plano. */
export const PRECOS: Record<FrequenciaPlano, Record<PlanoId, number>> = {
  "2x": { padrao: 479, ocioso: 419 },
  "3x": { padrao: 599, ocioso: 499 },
};

/** Upsell de frequência: sugere adicionar mais um treino semanal. */
export const PROXIMA_FREQUENCIA: Partial<Record<FrequenciaPlano, FrequenciaPlano>> = {
  "2x": "3x",
};

export function getPlano(id: PlanoId): PlanoDef {
  return PLANOS.find((p) => p.id === id)!;
}

export function getFrequencia(id: FrequenciaPlano): FrequenciaDef {
  return FREQUENCIAS.find((f) => f.id === id)!;
}

/** Nome completo do plano conforme a frequência escolhida. */
export function nomePlano(freq: FrequenciaPlano, plano: PlanoId): string {
  const def = getPlano(plano);
  const base = `PLANO ${freq.toUpperCase()}`;
  return def.sufixo ? `${base} · ${def.sufixo}` : base;
}

export function precoDe(freq: FrequenciaPlano, plano: PlanoId): number {
  return PRECOS[freq][plano];
}

/** Menor preço da linha da frequência — usado no "a partir de". */
export function precoMinimoDaFrequencia(freq: FrequenciaPlano): number {
  return Math.min(...Object.values(PRECOS[freq]));
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
