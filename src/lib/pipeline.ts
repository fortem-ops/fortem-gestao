// Pipeline helpers: stage colors, wa.me links, formatters.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Users, Mail, MessageCircle, MapPin, CheckSquare, type LucideIcon } from "lucide-react";

export type TipoAtividade = "ligacao" | "reuniao" | "email" | "whatsapp" | "visita" | "tarefa";
export const ATIVIDADE_TIPOS: TipoAtividade[] = ["ligacao", "reuniao", "email", "whatsapp", "visita", "tarefa"];
export const ATIVIDADE_CONFIG: Record<TipoAtividade, { label: string; icon: LucideIcon; defaultTitle: string }> = {
  ligacao:  { label: "Ligação",  icon: Phone,         defaultTitle: "Ligar" },
  reuniao:  { label: "Reunião",  icon: Users,         defaultTitle: "Reunião" },
  email:    { label: "E-mail",   icon: Mail,          defaultTitle: "Enviar e-mail" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, defaultTitle: "WhatsApp" },
  visita:   { label: "Visita",   icon: MapPin,        defaultTitle: "Visita" },
  tarefa:   { label: "Tarefa",   icon: CheckSquare,   defaultTitle: "Tarefa" },
};

/** Slug do funil (dinâmico agora — vinha do enum "prospects" | "aluno" | "inativo"). */
export type Funnel = string;

export interface PipelineFunnelRow {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  position: number;
  is_system: boolean;
  is_active: boolean;
}

/** Hook central: carrega funis ativos ordenados. Substitui a antiga constante FUNNELS. */
export function usePipelineFunnels(opts?: { includeInactive?: boolean }) {
  const includeInactive = !!opts?.includeInactive;
  return useQuery<PipelineFunnelRow[]>({
    queryKey: ["pipeline-funnels", includeInactive ? "all" : "active"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("pipeline_funnels")
        .select("id,slug,label,description,position,is_system,is_active")
        .order("position");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PipelineFunnelRow[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Gera um slug simples a partir de um label (remove acentos, espaços, símbolos). */
export function slugifyFunnel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "funil";
}

export const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-300",    dot: "bg-blue-500" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-300",   dot: "bg-amber-500" },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-300",  dot: "bg-orange-500" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-500" },
  rose:    { bg: "bg-rose-500/10",    border: "border-rose-500/30",    text: "text-rose-300",    dot: "bg-rose-500" },
  zinc:    { bg: "bg-zinc-500/10",    border: "border-zinc-500/40",    text: "text-zinc-300",    dot: "bg-zinc-500" },
};

export function stageColor(color: string) {
  return STAGE_COLORS[color] || STAGE_COLORS.blue;
}

/** Etapas terminais de "perdido" — disparam modal de motivo ao mover para elas. */
export const LOST_STAGE_NAMES = ["Aluno perdido", "Aluno inativo"] as const;
export function isLostStage(name?: string | null): boolean {
  return !!name && (LOST_STAGE_NAMES as readonly string[]).includes(name);
}

/** Badge color por plano de interesse. */
export const PLANO_BADGE_CLASSES: Record<string, string> = {
  "Start":   "bg-sky-500/20 text-sky-300 border-sky-500/40",
  "Start+":  "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  "Power":   "bg-amber-500/20 text-amber-300 border-amber-500/40",
  "Pro":     "bg-violet-500/20 text-violet-300 border-violet-500/40",
  "Max":     "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};
export const PLANOS_INTERESSE = ["Start", "Start+", "Power", "Pro", "Max"] as const;

/** Temperatura calculada automaticamente a partir da última atividade. */
export type LeadTemperature = "quente" | "morno" | "parado";
export function computeTemperature(lastActivityAt: string | Date | null | undefined): LeadTemperature {
  if (!lastActivityAt) return "parado";
  const d = typeof lastActivityAt === "string" ? new Date(lastActivityAt) : lastActivityAt;
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days <= 1) return "quente";
  if (days > 5) return "parado";
  return "morno";
}
export const TEMP_DOT_CLASS: Record<LeadTemperature, string> = {
  quente: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]",
  morno:  "bg-amber-400",
  parado: "bg-yellow-300/80",
};
export const TEMP_DOT_LABEL: Record<LeadTemperature, string> = {
  quente: "Quente — atividade recente",
  morno:  "Morno",
  parado: "Parado há +5 dias",
};

export const TEMPERATURE_COLORS: Record<string, string> = {
  frio:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  morno:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  quente: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export function formatCurrencyBRL(v: number | null | undefined): string {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Próxima ação formatada curta para o card: "Ligar amanhã 10h" */
export function formatNextAction(titulo: string, dueDate: string | null | undefined): string {
  if (!dueDate) return titulo;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  let when: string;
  if (diff === 0) when = "hoje";
  else if (diff === 1) when = "amanhã";
  else if (diff === -1) when = "ontem";
  else if (diff < 0) when = `há ${-diff}d`;
  else if (diff <= 7) when = `em ${diff}d`;
  else when = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return `${titulo} · ${when}`;
}

/** Returns a wa.me URL with pre-filled message. Strips non-digits from phone. */
export function waMeLink(telefone: string | null | undefined, message: string): string | null {
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Default to Brazil (55) if no country code
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export const QUICK_MESSAGES = [
  { key: "boas_vindas",       label: "Boas-vindas",        build: (n: string) => `Olá ${n}! Seja muito bem-vindo(a) à Fortem. Estamos felizes em ter você conosco. 💪` },
  { key: "confirmar_aval",    label: "Confirmar avaliação",build: (n: string) => `Olá ${n}, tudo bem? Confirmando sua avaliação física na Fortem. Posso contar com sua presença?` },
  { key: "lembrete_aval",     label: "Lembrete avaliação", build: (n: string) => `Oi ${n}! Passando para lembrar da sua avaliação amanhã na Fortem. Te aguardamos!` },
  { key: "convite_exp",       label: "Convite experimental", build: (n: string) => `Olá ${n}! Que tal conhecer nosso método com uma aula experimental gratuita? Posso agendar para você?` },
  { key: "enviar_proposta",   label: "Enviar proposta",    build: (n: string) => `Olá ${n}! Conforme conversamos, estou enviando a proposta dos nossos planos. Qualquer dúvida, estou à disposição.` },
  { key: "recuperar",         label: "Recuperar aluno",    build: (n: string) => `Oi ${n}, sentimos sua falta na Fortem! Vamos conversar para entender como podemos te ajudar a retomar a rotina?` },
] as const;

export type TaskIndicator = "today" | "overdue" | "scheduled" | "none";

export interface NextTaskInfo {
  id: string;
  titulo: string;
  data_limite: string | null;
  tipo_atividade?: TipoAtividade | string | null;
}

/** Determines task indicator from due date string (YYYY-MM-DD). */
export function taskIndicator(dueDate: string | null | undefined): TaskIndicator {
  if (!dueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() === today.getTime()) return "today";
  if (due.getTime() < today.getTime()) return "overdue";
  return "scheduled";
}

export const TASK_INDICATOR_CLASSES: Record<TaskIndicator, { bar: string; badge: string; label: string }> = {
  today:     { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", label: "Hoje" },
  overdue:   { bar: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",          label: "Atrasada" },
  scheduled: { bar: "bg-zinc-400",    badge: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",          label: "Agendada" },
  none:      { bar: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",       label: "Sem tarefa" },
};

/** Short label for badge: "Hoje", "Atrasada Nd", or "dd/MM". */
export function taskBadgeLabel(dueDate: string | null | undefined): string {
  const ind = taskIndicator(dueDate);
  if (ind === "none") return "Agendar";
  if (ind === "today") return "Hoje";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = (dueDate as string).split("-").map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1); due.setHours(0, 0, 0, 0);
  if (ind === "overdue") {
    const days = Math.round((today.getTime() - due.getTime()) / 86400000);
    return `Atrasada ${days}d`;
  }
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export function formatDaysAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

/** Filtro compartilhado Kanban/Lista para alunos do pipeline. */
export interface PipelineFilterInput {
  search: string;
  professorId: string | null;
  origem: string | null;
  quick: "todos" | "meus" | "quentes" | "parados" | "semana" | "atrasados";
}

/** Retorna true se o lead está atrasado na etapa (dias corridos > SLA). Null/undefined SLA = sem alerta. */
export function isStageOverdue(diasNaEtapa: number, slaDias: number | null | undefined): boolean {
  if (slaDias == null) return false;
  return diasNaEtapa > slaDias;
}

export function filterPipelineAlunos<T extends { id: string; nome: string; responsavel_id?: string | null; telefone?: string | null; email?: string | null; current_pipeline_stage_id?: string | null }>(
  alunos: T[],
  filters: PipelineFilterInput,
  metaMap: Record<string, any>,
  lastMovesMap: Record<string, string | undefined>,
  currentUserId: string | null | undefined,
  slaByStageId?: Record<string, number | null>,
): T[] {
  const term = (filters.search || "").trim().toLowerCase();
  const termDigits = term.replace(/\D/g, "");
  const isThisWeek = (d?: string | null) => !!d && Date.now() - new Date(d).getTime() <= 7 * 86400000;
  return alunos.filter((a) => {
    if (term) {
      const nomeMatch = a.nome.toLowerCase().includes(term);
      const emailMatch = !!a.email && a.email.toLowerCase().includes(term);
      const telDigits = (a.telefone || "").replace(/\D/g, "");
      const telMatch = !!termDigits && !!telDigits && telDigits.includes(termDigits);
      if (!nomeMatch && !emailMatch && !telMatch) return false;
    }
    if (filters.professorId && a.responsavel_id !== filters.professorId) return false;
    if (filters.origem) {
      const meta = metaMap[a.id];
      if (!meta || meta.origem_lead !== filters.origem) return false;
    }
    if (filters.quick === "meus") {
      if (!currentUserId || a.responsavel_id !== currentUserId) return false;
    }
    if (filters.quick === "quentes" || filters.quick === "parados") {
      const meta = metaMap[a.id];
      const cands = [meta?.last_contact_at, meta?.updated_at, lastMovesMap[a.id]].filter(Boolean) as string[];
      const last = cands.length ? new Date(Math.max(...cands.map((d) => new Date(d).getTime()))).toISOString() : null;
      const t = computeTemperature(last);
      if (filters.quick === "quentes" && t !== "quente") return false;
      if (filters.quick === "parados" && t !== "parado") return false;
    }
    if (filters.quick === "semana") {
      if (!isThisWeek(lastMovesMap[a.id])) return false;
    }
    return true;
  });
}
