/** Gatilhos de ponto removidos em 23/11/2026: ficam no banco só como histórico. */
export const GATILHOS_PONTO_REMOVIDOS = [
  "lembrete_entrada",
  "lembrete_intervalo_inicio",
  "lembrete_intervalo_fim",
  "lembrete_saida",
  "resumo_diario_ponto",
] as const;

export function disparoVisivel(gatilho: string): boolean {
  return !(GATILHOS_PONTO_REMOVIDOS as readonly string[]).includes(gatilho);
}
