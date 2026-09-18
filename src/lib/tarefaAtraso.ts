/**
 * Regras de atraso das tarefas, no fuso de São Paulo.
 * Uma tarefa está atrasada quando a data limite já passou, ou quando é hoje
 * e a hora limite (quando existe) já passou.
 */
export function agoraSaoPaulo(): { data: string; hora: string } {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [data, hora] = fmt.format(new Date()).split(" ");
  return { data, hora };
}

export function tarefaAtrasada(
  dataLimite: string | null | undefined,
  horaLimite?: string | null,
  agora = agoraSaoPaulo(),
): boolean {
  if (!dataLimite) return false;
  if (dataLimite < agora.data) return true;
  if (dataLimite > agora.data) return false;
  if (!horaLimite) return false;
  return horaLimite.slice(0, 8) <= agora.hora;
}
