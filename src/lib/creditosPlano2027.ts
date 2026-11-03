export interface CreditoCarteira {
  atividade: string;
  quantidade_inicial: number | null;
  quantidade_usada: number | null;
  ativo: boolean | null;
  data_validade: string | null;
}

/** Créditos de serviço de um plano 2027 (carteira creditos_aluno), agregados por atividade. */
export function creditoCarteira(
  creditos: CreditoCarteira[],
  atividade: string,
  hoje: string,
): { base: number; comprado: number; total: number; usado: number } {
  let total = 0;
  let usado = 0;
  for (const c of creditos) {
    if (c.atividade !== atividade || c.ativo === false) continue;
    if (c.data_validade && c.data_validade < hoje) continue;
    total += c.quantidade_inicial ?? 0;
    usado += c.quantidade_usada ?? 0;
  }
  return { base: total, comprado: 0, total, usado };
}
