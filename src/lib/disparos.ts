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

// ---- Etapa 3: variáveis do modelo e envio de teste ----
export type VariavelModelo = { pos: number; fonte: "campo" | "fixo"; valor: string };

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Valores posicionais ({{1}}, {{2}}…) de um modelo para um destinatário. Espelhado em supabase/functions/disparo-campanha. */
export function montarParametros(variaveis: VariavelModelo[], dados: { nome?: string | null; email?: string | null; telefone?: string | null }): string[] {
  const campo = (c: string): string => {
    switch (c) {
      case "primeiro_nome": return primeiroNome(dados.nome);
      case "nome_aluno": return (dados.nome ?? "").trim();
      case "email": return dados.email ?? "";
      case "telefone": return dados.telefone ?? "";
      case "link_festa": return "https://soufortem.com.br/10anos";
      default: return "";
    }
  };
  return [...variaveis].sort((a, b) => a.pos - b.pos)
    .map((v) => (v.fonte === "fixo" ? v.valor : campo(v.valor)).replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim());
}

/** Um envio por telefone: mantém o primeiro cadastro de cada telefone normalizado válido. */
export function dedupePorTelefone<T extends { telefone: string | null }>(lista: T[]): T[] {
  const vistos = new Set<string>();
  return lista.filter((x) => {
    const t = normalizarTelefone(x.telefone);
    if (!t || t.length < 12 || vistos.has(t)) return false;
    vistos.add(t);
    return true;
  });
}

// ---- Etapa 4: revisão, envio e histórico ----
export type StatusDestinatario = "pendente" | "enviando" | "enviado" | "falhou" | "ignorado";

/** O envio só libera se o total digitado for exatamente o total preparado (> 0). */
export function confirmacaoValida(digitado: string, totalPreparado: number | null | undefined): boolean {
  if (!totalPreparado || totalPreparado < 1) return false;
  const t = digitado.trim();
  return /^\d+$/.test(t) && Number(t) === totalPreparado;
}

/** 5551999998888 → +55 (51) 9****-8888 */
export function mascararTelefone(tel: string | null | undefined): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 12) return d ? "****" + d.slice(-2) : "—";
  const ddd = d.slice(2, 4), resto = d.slice(4);
  return `+${d.slice(0, 2)} (${ddd}) ${resto[0]}****-${resto.slice(-4)}`;
}

export function resumoStatus(linhas: { status: string }[]) {
  const r = { enviado: 0, falhou: 0, ignorado: 0, pendente: 0, total: linhas.length };
  for (const l of linhas) {
    if (l.status === "enviado") r.enviado++;
    else if (l.status === "falhou") r.falhou++;
    else if (l.status === "ignorado") r.ignorado++;
    else r.pendente++; // pendente + enviando
  }
  return r;
}

export const STATUS_CAMPANHA_LABEL: Record<string, string> = {
  rascunho: "Rascunho", pronta: "Pronta", enviando: "Enviando", pausada: "Pausada", concluida: "Concluída", cancelada: "Cancelada",
};
export const STATUS_DEST_LABEL: Record<string, string> = {
  pendente: "Pendente", enviando: "Enviando", enviado: "Enviado", falhou: "Falhou", ignorado: "Ignorado",
};
