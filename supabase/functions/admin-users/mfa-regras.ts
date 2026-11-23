// Regras puras da redefinição de 2FA (testadas no vitest).
export const STAFF_ROLES = ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"] as const;

export function ehEquipe(roles: string[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

export function validarResetMfa(p: {
  callerId: string;
  callerIsAdmin: boolean;
  targetId: string;
  targetRoles: string[];
}): string | null {
  if (!p.callerIsAdmin) return "Somente admin pode redefinir o 2FA.";
  if (p.callerId === p.targetId) return "Você não pode redefinir o seu próprio 2FA.";
  if (!ehEquipe(p.targetRoles)) return "Só é possível redefinir o 2FA de usuários da equipe.";
  return null;
}
