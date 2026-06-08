/**
 * Identifica planos com cobrança/renovação mensal automática.
 * Inclui: Start (mensal), Gympass/Wellhub, Total Pass.
 * NÃO inclui Start+ (anual), Pro, Power, Max.
 */
export function isAutoRenewPlan(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = tipo.toLowerCase().trim();
  // "Start" exato (não "Start+")
  const isStartMensal = t === "start" || t.startsWith("start ") || t.startsWith("start-");
  return (
    isStartMensal ||
    t.includes("gympass") ||
    t.includes("wellhub") ||
    t.includes("total pass") ||
    t.includes("totalpass")
  );
}
