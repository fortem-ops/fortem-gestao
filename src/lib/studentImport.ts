import { z } from "zod";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { ORIGEM_LEAD_OPTIONS, SEXO_OPTIONS, normalizePhone } from "@/lib/leads";
import { getPlanDetails } from "@/components/student/StudentFormFields";
import { isAutoRenewPlan } from "@/lib/planTipo";

export const CSV_HEADERS = [
  "nome",
  "email",
  "telefone",
  "data_nascimento",
  "sexo",
  "frequencia_semanal",
  "observacoes",
  "cpf",
  "rg",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "professor_nome",
  "plano_tipo",
  "plano_valor",
  "plano_data_inicio",
  "plano_consultas",
  "origem_lead",
  "status_cliente",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

const PLAN_TYPES = ["Start", "Start+", "Power", "Pro", "Max", "VIP", "Gympass/Wellhub", "Total Pass"] as const;
const SEXO_VALUES = SEXO_OPTIONS.map((s) => s.value);
const CONSULTAS = ["nutricao", "reabilitacao", "misto"] as const;
const STATUS_VALUES = ["ativo", "encerrado", "lead"] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateRegexIsoAlt = /^\d{2}-\d{2}-\d{4}$/;
const dateRegexBrSlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const dateRegexBrDash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

export const rowSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
    email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
    telefone: z.string().trim().max(20).optional().or(z.literal("")),
    data_nascimento: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, "Data de nascimento deve estar em AAAA-MM-DD ou DD-MM-AAAA")
      .optional()
      .or(z.literal("")),
    sexo: z.enum(SEXO_VALUES as [string, ...string[]]).optional().or(z.literal("")),
    frequencia_semanal: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(3)])
      .optional(),
    observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
    cpf: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || v.replace(/\D/g, "").length === 11, {
        message: "CPF deve ter 11 dígitos",
      }),
    rg: z.string().trim().max(30).optional().or(z.literal("")),
    cep: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || v.replace(/\D/g, "").length === 8, {
        message: "CEP deve ter 8 dígitos",
      }),
    logradouro: z.string().trim().max(200).optional().or(z.literal("")),
    numero: z.string().trim().max(20).optional().or(z.literal("")),
    complemento: z.string().trim().max(100).optional().or(z.literal("")),
    bairro: z.string().trim().max(100).optional().or(z.literal("")),
    cidade: z.string().trim().max(100).optional().or(z.literal("")),
    uf: z.string().trim().max(2).optional().or(z.literal("")),
    professor_nome: z.string().trim().max(100).optional().or(z.literal("")),
    plano_tipo: z.enum(PLAN_TYPES as unknown as [string, ...string[]]).optional().or(z.literal("")),
    plano_valor: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
    plano_data_inicio: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, "plano_data_inicio deve estar em AAAA-MM-DD ou DD-MM-AAAA")
      .optional()
      .or(z.literal("")),
    plano_consultas: z.enum(CONSULTAS as unknown as [string, ...string[]]).optional().or(z.literal("")),
    origem_lead: z
      .enum(ORIGEM_LEAD_OPTIONS as unknown as [string, ...string[]])
      .optional()
      .or(z.literal("")),
    status_cliente: z.enum(STATUS_VALUES as unknown as [string, ...string[]]).optional().or(z.literal("")),
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

// ---------- XLSX support ----------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normHeader(s: string): string {
  return stripAccents(String(s || "").toLowerCase()).replace(/\s+/g, " ").trim();
}

const EXCEL_HEADER_ALIASES: Record<string, CsvHeader> = {
  "cliente": "nome",
  "nome": "nome",
  "e-mail": "email",
  "email": "email",
  "telefone": "telefone",
  "data de nascimento": "data_nascimento",
  "data_nascimento": "data_nascimento",
  "sexo": "sexo",
  "frequencia semanal": "frequencia_semanal",
  "frequencia_semanal": "frequencia_semanal",
  "professor": "professor_nome",
  "professor_nome": "professor_nome",
  "plano": "plano_tipo",
  "plano_tipo": "plano_tipo",
  "plano valor": "plano_valor",
  "plano_valor": "plano_valor",
  "plano data de inicio": "plano_data_inicio",
  "plano_data_inicio": "plano_data_inicio",
  "plano consultas": "plano_consultas",
  "plano_consultas": "plano_consultas",
  "origem": "origem_lead",
  "origem_lead": "origem_lead",
  "indicacao": "origem_lead",
  "status cliente": "status_cliente",
  "status_cliente": "status_cliente",
  "status": "status_cliente",
  "cpf": "cpf",
  "rg": "rg",
  "cep": "cep",
  "logradouro": "logradouro",
  "numero": "numero",
  "complemento": "complemento",
  "bairro": "bairro",
  "cidade": "cidade",
  "uf": "uf",
  "observacoes": "observacoes",
  "observacao": "observacoes",
};

const IGNORED_HEADERS_LOG: string[] = [];

function normalizePlano(v: string): string {
  const s = stripAccents(v.trim().toUpperCase());
  if (!s || s === "-") return "";
  if (s === "START") return "Start";
  if (s === "START+" || s === "STARTPLUS" || s === "START +") return "Start+";
  if (s === "POWER") return "Power";
  if (s === "PRO") return "Pro";
  if (s === "MAX") return "Max";
  if (s === "VIP" || s.startsWith("VIP ") || s.startsWith("VIP-")) return "VIP";
  if (s.includes("GYMPASS") || s.includes("WELLHUB")) return "Gympass/Wellhub";
  if (s.includes("TOTAL") && s.includes("PASS")) return "Total Pass";
  return v.trim();
}

function normalizeConsultas(v: string): string {
  const s = stripAccents(v.trim().toLowerCase());
  if (!s || s === "-") return "";
  const hasNut = s.includes("nutri");
  const hasReab = s.includes("reab") || s.includes("fisio");
  if (hasNut && hasReab) return "misto";
  if (hasNut) return "nutricao";
  if (hasReab) return "reabilitacao";
  return v.trim();
}

function normalizeSexo(v: string): string {
  const s = stripAccents(v.trim().toLowerCase());
  if (!s || s === "-") return "";
  if (s.startsWith("masc") || s === "m") return "masculino";
  if (s.startsWith("fem") || s === "f") return "feminino";
  if (s.startsWith("outr")) return "outro";
  if (s.includes("nao") || s.includes("informar")) return "nao_informar";
  return v.trim();
}

function normalizeStatus(v: string): string {
  const s = stripAccents(v.trim().toLowerCase());
  if (!s || s === "-") return "";
  if (s === "ativo") return "ativo";
  if (s === "inativo" || s === "encerrado" || s === "cancelado") return "encerrado";
  if (s === "lead" || s === "prospect" || s === "prospecto") return "lead";
  return "";
}

function normalizeOrigem(v: string): string {
  const s = stripAccents(v.trim().toLowerCase());
  if (!s || s === "-" || s === "sistema") return "";
  for (const opt of ORIGEM_LEAD_OPTIONS) {
    if (stripAccents(opt.toLowerCase()) === s) return opt;
  }
  if (s.includes("indica")) return "Indicação";
  if (s.includes("fachada")) return "Fachada";
  if (s.includes("insta")) return "Instagram";
  if (s.includes("ex-aluno") || s.includes("ex aluno")) return "Ex-aluno";
  if (s.includes("gympass") || s.includes("wellhub")) return "Gympass/Wellhub";
  if (s.includes("total") && s.includes("pass")) return "Total Pass";
  if (s.includes("parceir")) return "Parceiros";
  return "";
}

function normalizeDate(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (!s || s === "-" || s === ".") return "";
  if (dateRegex.test(s)) return s;
  const brSlash = s.match(dateRegexBrSlash);
  if (brSlash) {
    const [, d, m, y] = brSlash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const brDash = s.match(dateRegexBrDash);
  if (brDash) {
    const [, d, m, y] = brDash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Excel serial number
  const num = Number(s);
  if (!Number.isNaN(num) && num > 1 && num < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + num * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return s;
}

function cleanCell(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "NULL") return "";
  return s;
}

function mapRawRow(raw: Record<string, any>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const nk = normHeader(key);
    const target = EXCEL_HEADER_ALIASES[nk];
    if (!target) {
      if (key && !IGNORED_HEADERS_LOG.includes(key)) IGNORED_HEADERS_LOG.push(key);
      continue;
    }
    let val = value;
    if (target === "data_nascimento" || target === "plano_data_inicio") {
      mapped[target] = normalizeDate(val);
      continue;
    }
    const s = cleanCell(val);
    if (!s) { mapped[target] = ""; continue; }
    switch (target) {
      case "sexo": mapped[target] = normalizeSexo(s); break;
      case "plano_tipo": mapped[target] = normalizePlano(s); break;
      case "plano_consultas": mapped[target] = normalizeConsultas(s); break;
      case "status_cliente": mapped[target] = normalizeStatus(s); break;
      case "origem_lead": mapped[target] = normalizeOrigem(s); break;
      case "cpf": mapped[target] = s.replace(/\D/g, ""); break;
      case "cep": mapped[target] = s.replace(/\D/g, ""); break;
      case "uf": mapped[target] = s.toUpperCase().slice(0, 2); break;
      case "plano_valor": {
        const n = Number(s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
        mapped[target] = Number.isFinite(n) ? String(n) : s;
        break;
      }
      default: mapped[target] = s;
    }
  }
  return mapped;
}

export interface ParsedFile {
  rows: Record<string, string>[];
  ignoredHeaders: string[];
}

export async function parseXLSX(file: File): Promise<ParsedFile> {
  IGNORED_HEADERS_LOG.length = 0;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], ignoredHeaders: [] };
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  const rows = json.map(mapRawRow).filter((r) => Object.values(r).some((v) => v && v.trim() !== ""));
  return { rows, ignoredHeaders: [...IGNORED_HEADERS_LOG] };
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
    "123.456.789-09",
    "12.345.678-9",
    "01310-100",
    "Av. Paulista",
    "1000",
    "Apto 101",
    "Bela Vista",
    "São Paulo",
    "SP",
    "Maria Professora",
    "Pro",
    "299.90",
    "2026-01-01",
    "nutricao",
    "Indicação",
    "ativo",
  ]
    .map((v) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v))
    .join(",");
  return `${header}\n${sample}\n`;
}

const XLSX_TEMPLATE_HEADERS = [
  "Cliente", "E-mail", "Telefone", "Data de Nascimento", "Sexo",
  "Frequencia Semanal", "Professor", "Plano", "Plano Valor",
  "Plano data de início", "Plano Consultas", "Origem", "Status Cliente",
  "CPF", "RG", "CEP", "Logradouro", "Número", "Complemento", "Bairro",
  "Cidade", "UF",
];

export function buildTemplateXLSX(): Blob {
  const sample = [
    "João da Silva", "joao@example.com", "(11) 99999-0000", "12-05-1990", "Masculino",
    "3", "Maria Professora", "PRO", "299.90",
    "01-01-2026", "Nutrição", "Indicação", "Ativo",
    "001.176.710-37", "12.345.678-9", "01310-100", "Av. Paulista", "1000", "Apto 101", "Bela Vista",
    "São Paulo", "SP",
  ];
  const ws = XLSX.utils.aoa_to_sheet([XLSX_TEMPLATE_HEADERS, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alunos");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export interface ValidatedRow {
  index: number;
  raw: Record<string, string>;
  parsed?: CsvRow;
  errors: string[];
  warnings: string[];
}

export type ImportStatus = "ativo" | "encerrado" | "lead";

export interface ImportContext {
  status: ImportStatus;
  currentUserId: string;
  existing: { email: string | null; telefone: string | null }[];
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

    const finalStatus = (p.status_cliente as ImportStatus) || ctx.status;

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
          cpf: p.cpf ? p.cpf.replace(/\D/g, "") : null,
          rg: p.rg || null,
          cep: p.cep ? p.cep.replace(/\D/g, "") : null,
          logradouro: p.logradouro || null,
          numero: p.numero || null,
          complemento: p.complemento || null,
          bairro: p.bairro || null,
          cidade: p.cidade || null,
          uf: p.uf || null,
          status: finalStatus,
          responsavel_id: responsavelId,
        })
        .select("id")
        .single();
      if (error) throw error;

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
            renovacao_automatica: isAutoRenewPlan(plan.tipo) || undefined,
          });
          if (planErr) console.error("Erro ao criar plano:", planErr);
        }
      }

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
