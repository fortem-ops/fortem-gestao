const relogio = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export function horarioFuturoPortal(data: string, horario: string, agora: Date): boolean {
  const p = Object.fromEntries(relogio.formatToParts(agora).map((p) => [p.type, p.value]));
  const hoje = `${p.year}-${p.month}-${p.day}`;
  if (data !== hoje) return data > hoje;
  const [hora = "00", minuto = "00", segundo = "00"] = horario.split(":");
  return `${hora}:${minuto}:${segundo}` > `${p.hour}:${p.minute}:${p.second}`;
}
export interface DesafioPortal {
  id: string; titulo: string; descricao?: string | null;
  progresso_atual: number; valor_meta: number; data_fim: string;
  pontos_recompensa?: number; mensagem_recompensa?: string | null;
}
export function percentualDesafio(d: DesafioPortal): number {
  return d.valor_meta > 0 ? Math.max(0, Math.min(100, Math.round(d.progresso_atual / d.valor_meta * 100))) : 0;
}
export function desafioMaisProximo(desafios: DesafioPortal[]): DesafioPortal | undefined {
  const proporcao = (d: DesafioPortal) => d.valor_meta > 0 ? d.progresso_atual / d.valor_meta : 0;
  return [...desafios].sort((a, b) => proporcao(b) - proporcao(a) || a.data_fim.localeCompare(b.data_fim))[0];
}