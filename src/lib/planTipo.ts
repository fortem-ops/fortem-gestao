export function isAutoRenewPlan(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = tipo.toLowerCase();
  return (
    t.includes("start") ||
    t.includes("gympass") ||
    t.includes("wellhub") ||
    t.includes("total pass") ||
    t.includes("totalpass")
  );
}
