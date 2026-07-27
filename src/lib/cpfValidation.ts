// Validação e checagem de unicidade de CPF (agora via cpf_hash).
import { supabase } from "@/integrations/supabase/client";
import { hashCpfClient } from "@/lib/clube";

export function normalizeCpf(cpf: string | null | undefined): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/** Valida dígitos verificadores do CPF (11 dígitos). */
export function isValidCpfDigits(cpf: string | null | undefined): boolean {
  const d = normalizeCpf(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += parseInt(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

export interface ExistingAlunoByCpf {
  id: string;
  nome: string;
}

/**
 * Busca aluno existente com o mesmo CPF (via cpf_hash).
 * `excludeId` permite ignorar o próprio aluno durante edição.
 */
export async function findAlunoByCpf(
  cpf: string,
  excludeId?: string,
): Promise<ExistingAlunoByCpf | null> {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return null;
  const hash = await hashCpfClient(digits);
  let q = supabase
    .from("alunos")
    .select("id, nome")
    .eq("cpf_hash", hash)
    .limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return data && data.length > 0 ? (data[0] as ExistingAlunoByCpf) : null;
}

export function duplicateCpfMessage(existing: ExistingAlunoByCpf): string {
  return `CPF já cadastrado para ${existing.nome}. Verifique se foi digitado corretamente.`;
}

/** Traduz erro do Postgres (23505 no índice de CPF) para mensagem amigável. */
export function translateCpfDbError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const msg = String((error as any).message ?? "");
  const code = String((error as any).code ?? "");
  if (code === "23505" && (msg.includes("cpf_hash") || msg.includes("alunos_cpf"))) {
    return "CPF já cadastrado no sistema.";
  }
  return null;
}
