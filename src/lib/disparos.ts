// Regras do público do Disparo de Mensagens. Espelham fn_msg_publico no banco.
export type CanalDisparo = "email" | "whatsapp";
export type SituacaoChip = "ativos" | "ex_alunos" | "leads" | "prospects" | "avulsos";
export type MotivoExclusao = "equipe" | "optout" | "confirmou" | "sem_contato";

export const CHIPS: { v: SituacaoChip; l: string; status: string[] }[] = [
  { v: "ativos", l: "Ativos", status: ["ativo"] },
  { v: "ex_alunos", l: "Inativos/ex-alunos", status: ["inativo", "cancelado"] },
  { v: "leads", l: "Leads", status: ["lead"] },
  { v: "prospects", l: "Prospects", status: ["prospect"] },
  { v: "avulsos", l: "Avulsos", status: ["avulso"] },
];

export const MOTIVO_LABEL: Record<MotivoExclusao, string> = {
  equipe: "Equipe", optout: "Opt-out", confirmou: "Já confirmou na festa", sem_contato: "Sem contato no canal",
};

export function statusDosChips(chips: SituacaoChip[]): string[] {
  return [...new Set(CHIPS.filter((c) => chips.includes(c.v)).flatMap((c) => c.status))];
}

/** Idêntica a normalizarTelefone de supabase/functions/_shared/whatsapp.ts. */
export function normalizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length >= 10) return "55" + digits;
  return digits;
}

export function telefoneValidoWhatsapp(tel: string | null | undefined): boolean {
  return (normalizarTelefone(tel) ?? "").length >= 12;
}

export function normalizarEmail(e: string | null | undefined): string | null {
  const v = (e ?? "").trim().toLowerCase();
  return v || null;
}

export type CadastroPublico = { id: string; status: string; is_equipe: boolean; email: string | null; telefone: string | null };
export type OptOut = { canal: CanalDisparo; email_norm: string | null; telefone_norm: string | null; aluno_id: string | null };
export type OpcoesPublico = { canal: CanalDisparo; excluirConfirmados: boolean; excluirSemContato: boolean };

export function motivoExclusao(
  c: CadastroPublico, optouts: OptOut[], telefonesConfirmados: Set<string>, op: OpcoesPublico,
): MotivoExclusao | null {
  const tel = normalizarTelefone(c.telefone);
  const telOk = (tel ?? "").length >= 12;
  const email = normalizarEmail(c.email);
  if (c.is_equipe) return "equipe";
  if (optouts.some((o) => o.canal === op.canal && (o.aluno_id === c.id
    || (op.canal === "email" && !!email && o.email_norm === email)
    || (op.canal === "whatsapp" && !!tel && o.telefone_norm === tel)))) return "optout";
  if (op.excluirConfirmados && telOk && telefonesConfirmados.has(tel!)) return "confirmou";
  if (op.excluirSemContato && (op.canal === "email" ? !email : !telOk)) return "sem_contato";
  return null;
}

export function confirmadosPorTelefone(whatsapps: (string | null)[]): Set<string> {
  return new Set(whatsapps.map(normalizarTelefone).filter((t): t is string => !!t));
}

export function resumoPublico(
  cadastros: CadastroPublico[], chips: SituacaoChip[], optouts: OptOut[], confirmados: Set<string>, op: OpcoesPublico,
) {
  const st = statusDosChips(chips);
  const lista = cadastros.filter((c) => st.includes(c.status));
  const r = { total: lista.length, com_email: 0, com_whats: 0, elegiveis: 0, equipe: 0, optout: 0, confirmou: 0, sem_contato: 0 };
  for (const c of lista) {
    if (normalizarEmail(c.email)) r.com_email++;
    if (telefoneValidoWhatsapp(c.telefone)) r.com_whats++;
    const m = motivoExclusao(c, optouts, confirmados, op);
    if (m) r[m]++; else r.elegiveis++;
  }
  return r;
}
