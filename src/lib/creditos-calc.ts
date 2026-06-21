export type CreditoAluno = {
  quantidade_inicial?: number | null;
  quantidade_usada?: number | null;
  ilimitado?: boolean | null;
  data_validade?: string | Date | null;
  ativo?: boolean | null;
};

export function creditoDisponivel(c: CreditoAluno): number {
  if (c.ilimitado === true) return Infinity;
  const ini = Number(c.quantidade_inicial) || 0;
  const usa = Number(c.quantidade_usada) || 0;
  return ini - usa;
}

export function creditoExpirado(c: CreditoAluno, now: Date = new Date()): boolean {
  if (c.data_validade == null) return false;
  const dt = c.data_validade instanceof Date ? c.data_validade : new Date(c.data_validade);
  return dt.getTime() < now.getTime();
}

export function creditoAtivo(c: CreditoAluno, now: Date = new Date()): boolean {
  return c.ativo === true && !creditoExpirado(c, now);
}
