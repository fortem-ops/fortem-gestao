import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ORIGEM_LEAD_OPTIONS, SEXO_OPTIONS, normalizePhone } from "@/lib/leads";
import { getPlanDetails } from "@/components/student/StudentFormFields";

export const CSV_HEADERS = [
  "nome",
  "email",
  "telefone",
  "data_nascimento",
  "sexo",
  "frequencia_semanal",
  "observacoes",
  "cpf",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "professor_nome",
  "plano_tipo",
  "plano_valor",
  "plano_data_inicio",
  "plano_consultas",
  "origem_lead",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

const PLAN_TYPES = ["Start", "Start+", "Power", "Pro", "Max", "Gympass/Wellhub", "Total Pass"] as const;
const SEXO_VALUES = SEXO_OPTIONS.map((s) => s.value);
const CONSULTAS = ["nutricao", "reabilitacao", "misto"] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const rowSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
    email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
    telefone: z.string().trim().max(20).optional().or(z.literal("")),
    data_nascimento: z
      .string()
      .trim()
      .regex(dateRegex, "Data de nascimento deve estar em AAAA-MM-DD")
      .optional()
      .or(z.literal("")),
    sexo: z.enum(SEXO_VALUES as [string, ...string[]]).optional().or(z.literal("")),
    frequencia_semanal: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(3)])
      .optional(),
    observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
    professor_nome: z.string().trim().max(100).optional().or(z.literal("")),
    plano_tipo: z.enum(PLAN_TYPES as unknown as [string, ...string[]]).optional().or(z.literal("")),
    plano_valor: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
    plano_data_inicio: z
      .string()
      .trim()
      .regex(dateRegex, "plano_data_inicio deve estar em AAAA-MM-DD")
      .optional()
      .or(z.literal("")),
    plano_consultas: z.enum(CONSULTAS as unknown as [string, ...string[]]).optional().or(z.literal("")),
    origem_lead: z
      .enum(ORIGEM_LEAD_OPTIONS as unknown as [string, ...string[]])
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (v) => !(v.plano_tipo === "Power" && !v.plano_consultas),
    { message: "Plano Power exige plano_consultas (nutricao ou reabilitacao)", path: ["plano_consultas"] }
  )
  .refine(
    (v) => !(v.plano_tipo === "Pro" && !v.plano_consultas),
    { message: "Plano Pro exige plano_consultas (nutricao, reabilitacao ou misto)", path: ["plano_consultas"] }
  )
  .refine((v) => v.plano_consultas !== "misto" || v.plano_tipo === "Pro", {
    message: "plano_consultas 'misto' só é válido para Pro",
    path: ["plano_consultas"],
  });

export type CsvRow = z.infer<typeof rowSchema>;

/** Parse simple CSV with quoted-field handling. Returns array of objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur); }
  const nonEmpty = lines.filter((l) => l.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cols) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (cols[idx] ?? "").trim(); });
    return o;
  });
}

export function buildTemplateCSV(): string {
  const header = CSV_HEADERS.join(",");
  const sample = [
    "João da Silva",
    "joao@example.com",
    "(11) 99999-0000",
    "1990-05-12",
    "masculino",
    "3",
    "Aluno indicado por amigo",
    "Maria Professora",
    "Pro",
    "299.90",
    "2026-01-01",
    "nutricao",
    "Indicação",
  ]
    .map((v) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v))
    .join(",");
  return `${header}\n${sample}\n`;
}

export interface ValidatedRow {
  index: number; // 1-based row number (after header)
  raw: Record<string, string>;
  parsed?: CsvRow;
  errors: string[];
  warnings: string[];
}

export type ImportStatus = "ativo" | "encerrado" | "lead";

export interface ImportContext {
  status: ImportStatus;
  currentUserId: string;
  /** existing alunos for duplicate detection (email + normalized phone) */
  existing: { email: string | null; telefone: string | null }[];
  /** map professor full_name (lowercase) → user_id */
  professorMap: Record<string, string>;
}

export function validateRows(rows: Record<string, string>[], ctx: ImportContext): ValidatedRow[] {
  const existingEmails = new Set(
    ctx.existing.map((a) => (a.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const existingPhones = new Set(
    ctx.existing.map((a) => normalizePhone(a.telefone)).filter((p) => p.length >= 8)
  );

  return rows.map((raw, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const result = rowSchema.safeParse(raw);
    let parsed: CsvRow | undefined;
    if (!result.success) {
      result.error.issues.forEach((iss) => errors.push(`${iss.path.join(".") || "linha"}: ${iss.message}`));
    } else {
      parsed = result.data;
      if (parsed.professor_nome && !ctx.professorMap[parsed.professor_nome.toLowerCase()]) {
        warnings.push(`Professor "${parsed.professor_nome}" não encontrado — será atribuído o usuário atual.`);
      }
      const emailKey = (parsed.email || "").trim().toLowerCase();
      const phoneKey = normalizePhone(parsed.telefone);
      if (emailKey && existingEmails.has(emailKey)) {
        warnings.push("Já existe aluno com este e-mail (importação prossegue).");
      }
      if (phoneKey && phoneKey.length >= 8 && existingPhones.has(phoneKey)) {
        warnings.push("Já existe aluno com este telefone (importação prossegue).");
      }
    }
    return { index: i + 1, raw, parsed, errors, warnings };
  });
}

export interface ImportResult {
  success: number;
  failed: { index: number; nome: string; reason: string }[];
}

export async function importStudents(
  validated: ValidatedRow[],
  ctx: ImportContext
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: [] };
  const today = new Date().toISOString().split("T")[0];

  for (const row of validated) {
    if (!row.parsed) {
      result.failed.push({
        index: row.index,
        nome: row.raw.nome || "(sem nome)",
        reason: row.errors.join("; "),
      });
      continue;
    }
    const p = row.parsed;
    const responsavelId =
      (p.professor_nome && ctx.professorMap[p.professor_nome.toLowerCase()]) ||
      ctx.currentUserId;

    try {
      const { data: aluno, error } = await supabase
        .from("alunos")
        .insert({
          nome: p.nome,
          email: p.email || null,
          telefone: p.telefone || null,
          data_nascimento: p.data_nascimento || null,
          sexo: p.sexo || null,
          frequencia_semanal:
            typeof p.frequencia_semanal === "number" ? p.frequencia_semanal : null,
          observacoes: p.observacoes || null,
          status: ctx.status,
          responsavel_id: responsavelId,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Plano (opcional)
      if (p.plano_tipo) {
        const plan = getPlanDetails(p.plano_tipo, p.plano_consultas || undefined);
        if (plan) {
          const { error: planErr } = await supabase.from("planos").insert({
            aluno_id: aluno.id,
            tipo: plan.tipo,
            data_inicio: p.plano_data_inicio || today,
            duracao_meses: plan.duracao_meses,
            servicos: plan.servicos,
            valor: typeof p.plano_valor === "number" ? p.plano_valor : 0,
            ativo: true,
          });
          if (planErr) console.error("Erro ao criar plano:", planErr);
        }
      }

      // Origem do lead
      if (p.origem_lead) {
        await supabase
          .from("pipeline_metadata")
          .upsert(
            { aluno_id: aluno.id, origem_lead: p.origem_lead, responsavel_comercial_id: responsavelId },
            { onConflict: "aluno_id" }
          );
      }

      result.success++;
    } catch (e: any) {
      result.failed.push({
        index: row.index,
        nome: p.nome,
        reason: e.message || "Erro desconhecido",
      });
    }
  }
  return result;
}

export async function loadImportContext(status: ImportStatus): Promise<ImportContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const [{ data: existing }, { data: roles }] = await Promise.all([
    supabase.from("alunos").select("email, telefone"),
    supabase.from("user_roles").select("user_id, role").in("role", ["professor", "coordenador", "admin"]),
  ]);

  const professorMap: Record<string, string> = {};
  if (roles?.length) {
    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    (profiles || []).forEach((p: any) => {
      if (p.full_name) professorMap[String(p.full_name).toLowerCase()] = p.user_id;
    });
  }

  return {
    status,
    currentUserId: user.id,
    existing: (existing || []) as { email: string | null; telefone: string | null }[],
    professorMap,
  };
}
