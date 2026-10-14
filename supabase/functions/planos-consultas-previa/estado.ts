export type StatusPrevia = 'pendente' | 'aprovado' | 'recusado' | 'desconhecido';
export type EstadoPrevia = { plano: StatusPrevia; consultas: StatusPrevia; obrigacao_id: string | null; tentativa?: { id: string; status: string; ref: string } };
export const inicial = (): EstadoPrevia => ({ plano: 'pendente', consultas: 'pendente', obrigacao_id: null });
export function autorizarPrevia(admin: boolean, previa: boolean, teste: boolean, simulacao: boolean) {
  return admin && previa && teste && simulacao;
}
export function avancar(e: EstadoPrevia, parte: 'plano' | 'consultas', resultado: StatusPrevia, aceite: boolean, novoAceite: boolean): EstadoPrevia {
  if (resultado === 'pendente') throw new Error('Resultado inválido');
  if (!aceite || novoAceite) throw new Error('Leia e aceite as condições atuais das consultas');
  if (e[parte] === 'desconhecido') throw new Error('Resultado desconhecido: nova cobrança bloqueada');
  if (e[parte] === 'aprovado') return e;
  if (parte === 'consultas' && e.plano !== 'aprovado') throw new Error('Aprove o plano primeiro');
  return { ...e, [parte]: resultado };
}
