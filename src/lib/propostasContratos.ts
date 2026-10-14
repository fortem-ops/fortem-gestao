export const PROPOSTAS_CONTRATOS_PATH = "/financeiro/propostas-contratos";

export function propostasAccess(roles?: { isAdmin?: boolean; isCoordAdmin?: boolean }) {
  return { canView: !!roles?.isCoordAdmin, canManage: !!roles?.isAdmin };
}

export function legacyPropostasLocation(search: string, hash = "") {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") ?? params.get("aba");
  if (tab !== "propostas" && tab !== "propostas-site" && hash !== "#propostas") return null;
  params.delete("tab");
  params.delete("aba");
  const remaining = params.toString();
  return PROPOSTAS_CONTRATOS_PATH + (remaining ? `?${remaining}` : "");
}