/**
 * E5a — Agenda no app do aluno.
 * `somenteOnline` vem de fn_aluno_somente_online:
 *   true  = confirmado só Consultoria Online → Agenda escondida
 *   false = presencial / sem plano → Agenda normal
 *   null  = carregando ou erro → comportamento atual (Agenda visível, sem redirecionar)
 */
export type SomenteOnline = boolean | null;

export function agendaOculta(somenteOnline: SomenteOnline | undefined): boolean {
  return somenteOnline === true;
}

export function filtrarNavPortal<T extends { to: string }>(itens: T[], somenteOnline: SomenteOnline | undefined): T[] {
  return agendaOculta(somenteOnline) ? itens.filter((i) => i.to !== "/portal/agenda") : itens;
}
