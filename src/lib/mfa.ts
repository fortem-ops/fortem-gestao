import { supabase } from "@/integrations/supabase/client";

export type MfaDestino = "liberado" | "cadastro" | "desafio";

/** Regra da Fase 1: só equipe precisa de 2FA; aluno e usuário sem papel passam direto. */
export function decidirMfa(params: {
  isStaff: boolean;
  currentLevel: string | null | undefined;
  fatoresVerificados: number;
}): MfaDestino {
  if (!params.isStaff) return "liberado";
  if (params.currentLevel === "aal2") return "liberado";
  return params.fatoresVerificados > 0 ? "desafio" : "cadastro";
}

export function codigoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}

export interface MfaEstado {
  currentLevel: string | null;
  fatores: { id: string; friendly_name?: string; created_at: string }[];
}

export async function carregarMfaEstado(): Promise<MfaEstado> {
  const [{ data: aal, error: aalErr }, { data: lista, error: listErr }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (aalErr) throw aalErr;
  if (listErr) throw listErr;
  return {
    currentLevel: aal?.currentLevel ?? null,
    fatores: (lista?.totp ?? [])
      .filter((f) => f.status === "verified")
      .map((f) => ({ id: f.id, friendly_name: f.friendly_name, created_at: f.created_at })),
  };
}

/** Remove fatores não confirmados (cadastro interrompido) para permitir recomeçar. */
export async function limparFatoresPendentes(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  const pendentes = (data?.all ?? []).filter((f) => f.status !== "verified");
  for (const f of pendentes) await supabase.auth.mfa.unenroll({ factorId: f.id });
}

export const MSG_CODIGO_ERRADO =
  "Código incorreto ou expirado. Confira o horário do celular e tente de novo.";
