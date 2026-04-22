// Pipeline helpers: stage colors, wa.me links, formatters.

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

export const TEMPERATURE_COLORS: Record<string, string> = {
  frio:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  morno:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  quente: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

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

export function formatDaysAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}
