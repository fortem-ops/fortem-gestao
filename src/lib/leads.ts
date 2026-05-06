import { supabase } from "@/integrations/supabase/client";

export const ORIGEM_LEAD_OPTIONS = [
  "Indicação",
  "Fachada",
  "Instagram",
  "Ex-aluno",
  "Gympass/Wellhub",
  "Total Pass",
  "Parceiros",
] as const;

export type OrigemLead = (typeof ORIGEM_LEAD_OPTIONS)[number];

export const SEXO_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
  { value: "nao_informar", label: "Prefiro não informar" },
] as const;

/** Normaliza telefone para apenas dígitos. */
export function normalizePhone(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/** Verifica se já existe um aluno com mesmo telefone (para evitar duplicação). */
export async function findAlunoByPhone(telefone: string): Promise<{ id: string; nome: string } | null> {
  const digits = normalizePhone(telefone);
  if (digits.length < 8) return null;
  const { data } = await supabase.from("alunos").select("id, nome, telefone");
  const found = (data || []).find((a) => normalizePhone(a.telefone) === digits);
  return found ? { id: found.id, nome: found.nome } : null;
}

export interface CreateLeadInput {
  nome: string;
  telefone: string;
  origem: OrigemLead;
  responsavel_id?: string | null;
}

/** Cria um novo Lead: insere em alunos, registra origem em pipeline_metadata e move para "Novo lead". */
export async function createLead(input: CreateLeadInput): Promise<string> {
  const { data: aluno, error } = await supabase
    .from("alunos")
    .insert({
      nome: input.nome.trim(),
      telefone: input.telefone.trim(),
      status: "lead",
      responsavel_id: input.responsavel_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const alunoId = aluno.id;

  await supabase
    .from("pipeline_metadata")
    .upsert({ aluno_id: alunoId, origem_lead: input.origem }, { onConflict: "aluno_id" });

  const { error: moveErr } = await supabase.rpc("fn_move_pipeline" as any, {
    _aluno_id: alunoId,
    _to_stage_name: "Novo lead",
    _source: "manual",
    _notes: "Lead criado",
  });
  if (moveErr) throw moveErr;

  return alunoId;
}

export interface ConvertProspectInput {
  alunoId: string;
  data_nascimento?: string | null;
  email?: string | null;
  sexo?: string | null;
  origem?: OrigemLead | null;
  limitacoes?: string | null;
  atividade_fisica?: string | null;
  objetivo_treinamento?: string | null;
}

export async function convertLeadToProspect(input: ConvertProspectInput): Promise<void> {
  const { error } = await supabase.rpc("fn_convert_lead_to_prospect" as any, {
    _aluno_id: input.alunoId,
    _data_nascimento: input.data_nascimento || null,
    _email: input.email || null,
    _sexo: input.sexo || null,
    _origem: input.origem || null,
    _limitacoes: input.limitacoes || null,
    _atividade_fisica: input.atividade_fisica || null,
    _objetivo_treinamento: input.objetivo_treinamento || null,
  });
  if (error) throw error;
}
