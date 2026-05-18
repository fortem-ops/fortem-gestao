import { supabase } from "@/integrations/supabase/client";

export type QuestionType =
  | "sim_nao"
  | "sim_nao_detalhe"
  | "sim_nao_numero"
  | "sim_nao_dupla"
  | "texto"
  | "numero"
  | "opcoes";

export interface OpcaoItem { value: string; label: string }

export interface TemplateQuestion {
  id: string;
  label: string;
  type: QuestionType;
  detalheLabel?: string;
  labelSim?: string;
  labelNao?: string;
  options?: OpcaoItem[];
}

export interface TemplateSection {
  id: string;
  title: string;
  questions: TemplateQuestion[];
}

export interface ExperimentalSchema {
  sections: TemplateSection[];
}

export interface ExperimentalAnswers {
  // sim_nao: "sim"|"nao"|""
  // sim_nao_detalhe: { v: "sim"|"nao"|""; detalhe: string }
  // sim_nao_numero: { v: "sim"|"nao"|""; numero: string }
  // sim_nao_dupla: { v: "sim"|"nao"|""; sim: string; nao: string }
  // texto/numero: string
  // opcoes: string (value)
  [questionId: string]: unknown;
}

export interface ExperimentalRecordDados {
  status: "rascunho" | "finalizado";
  finalized_at: string | null;
  answers: ExperimentalAnswers;
}

export const EMPTY_DADOS: ExperimentalRecordDados = {
  status: "rascunho",
  finalized_at: null,
  answers: {},
};

export const DEFAULT_SCHEMA: ExperimentalSchema = {
  sections: [
    {
      id: "anamnese",
      title: "Anamnese",
      questions: [
        { id: "saude", label: "Histórico de saúde diagnosticado?", type: "sim_nao_detalhe", detalheLabel: "Quais?" },
      ],
    },
  ],
};

/** Converte formato antigo (anamnese/mobilidade) para o novo (answers). */
export function migrateLegacyDados(raw: Record<string, unknown> | null | undefined): ExperimentalRecordDados {
  if (!raw) return { ...EMPTY_DADOS };
  if (raw.answers && typeof raw.answers === "object") {
    return {
      status: (raw.status as "rascunho" | "finalizado") ?? "rascunho",
      finalized_at: (raw.finalized_at as string) ?? null,
      answers: raw.answers as ExperimentalAnswers,
    };
  }
  // legado
  const a = (raw.anamnese as Record<string, Record<string, unknown>>) ?? {};
  const m = (raw.mobilidade as Record<string, unknown>) ?? {};
  const answers: ExperimentalAnswers = {};
  const sn = (v: unknown) => (v === "sim" || v === "nao" ? v : "");
  if (a.saude) answers["saude"] = { v: sn(a.saude.tem), detalhe: (a.saude.detalhe as string) ?? "" };
  if (a.medicacao) answers["medicacao"] = { v: sn(a.medicacao.usa), detalhe: (a.medicacao.qual as string) ?? "" };
  if (a.gestante) answers["gestante"] = { v: sn(a.gestante.esta), numero: (a.gestante.semanas as string) ?? "" };
  if (a.limitacoes) answers["limitacoes"] = { v: sn(a.limitacoes.tem), detalhe: (a.limitacoes.quais as string) ?? "" };
  if (a.atividade) answers["atividade"] = {
    v: sn(a.atividade.pratica),
    sim: (a.atividade.qual as string) ?? "",
    nao: (a.atividade.tempo_parado as string) ?? "",
  };
  if (a.motivo_objetivo !== undefined) answers["motivo_objetivo"] = a.motivo_objetivo;
  for (const k of ["gatinho", "rocking", "rotacao_ombro", "hip_hinge", "observacoes"]) {
    if (m[k] !== undefined) answers[k] = m[k];
  }
  return {
    status: (raw.status as "rascunho" | "finalizado") ?? "rascunho",
    finalized_at: (raw.finalized_at as string) ?? null,
    answers,
  };
}

export async function fetchExperimentalSchema(): Promise<ExperimentalSchema> {
  const { data, error } = await supabase
    .from("avaliacao_templates" as never)
    .select("schema")
    .eq("tipo", "experimental")
    .maybeSingle();
  if (error) throw error;
  const schema = (data as { schema?: ExperimentalSchema } | null)?.schema;
  if (!schema?.sections?.length) return DEFAULT_SCHEMA;
  return schema;
}

export async function saveExperimentalSchema(schema: ExperimentalSchema, userId: string) {
  const { error } = await supabase
    .from("avaliacao_templates" as never)
    .update({ schema: schema as never, updated_by: userId, updated_at: new Date().toISOString() } as never)
    .eq("tipo", "experimental");
  if (error) throw error;
}

export function newQuestion(type: QuestionType = "sim_nao_detalhe"): TemplateQuestion {
  const base: TemplateQuestion = {
    id: crypto.randomUUID(),
    label: "Nova pergunta",
    type,
  };
  if (type === "sim_nao_detalhe") base.detalheLabel = "Detalhe";
  if (type === "sim_nao_numero") base.detalheLabel = "Número";
  if (type === "sim_nao_dupla") {
    base.labelSim = "Se sim, qual?";
    base.labelNao = "Se não, há quanto tempo?";
  }
  if (type === "opcoes") base.options = [
    { value: "opcao_1", label: "Opção 1" },
    { value: "opcao_2", label: "Opção 2" },
  ];
  return base;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  sim_nao: "Sim / Não",
  sim_nao_detalhe: "Sim/Não + campo de detalhe (se Sim)",
  sim_nao_numero: "Sim/Não + número (se Sim)",
  sim_nao_dupla: "Sim/Não + campo (Sim) + campo (Não)",
  texto: "Texto livre",
  numero: "Número",
  opcoes: "Múltipla escolha (única seleção)",
};
