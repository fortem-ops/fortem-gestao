// Cálculo compartilhado de saldo de serviços por atividade.
// Fonte 1: serviços inclusos no plano (planos.servicos + consumo_servicos)
// Fonte 2: créditos avulsos (creditos_aluno)
// Usado por PortalHome e PortalAgenda para evitar divergência.

export type ConsumoServico = {
  tipo_servico: string;
  tipo_registro?: string | null;
  quantidade?: number | null;
  agenda_id?: string | null;
};

export type CreditoAlunoRow = {
  atividade: string;
  quantidade_inicial?: number | null;
  quantidade_usada?: number | null;
  ilimitado?: boolean | null;
  /** "plano" = crédito do plano já gravado no ledger; outros = avulso/serviço. */
  origem_tipo?: string | null;
};

/** Mapeia o rótulo do serviço no plano para o nome da atividade na agenda. */
export const SERVICOS_PLANO: { tipo: string; label: string }[] = [
  { tipo: "Avaliação Funcional", label: "Avaliação Funcional" },
  { tipo: "Consultas Nutrição", label: "Nutrição" },
  { tipo: "Consultas Reabilitação", label: "Reabilitação" },
];

export function parseServiceCount(
  servicos: string[] | null | undefined,
  tipo: string,
): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const m = s.match(/^(\d+)\s+(.+)$/);
    if (m && m[2] === tipo) return parseInt(m[1]);
  }
  return 0;
}

/** Total contratado (plano + compras) e total usado de um tipo de serviço do plano. */
export function buildInclusoPlano(
  planoServicos: string[] | null | undefined,
  consumos: ConsumoServico[],
  tipo: string,
): { total: number; usado: number } {
  const base = parseServiceCount(planoServicos, tipo);
  const comprado = consumos
    .filter((c) => c.tipo_servico === tipo && c.tipo_registro === "compra")
    .reduce((sum, c) => sum + (c.quantidade ?? 1), 0);
  const usado = consumos.filter(
    (c) => c.tipo_servico === tipo && (!!c.agenda_id || c.tipo_registro === "uso_manual"),
  ).length;
  return { total: base + comprado, usado };
}

/** Saldo por atividade proveniente do plano. */
export function saldoPlanoPorAtividade(
  planoServicos: string[] | null | undefined,
  consumos: ConsumoServico[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const cfg of SERVICOS_PLANO) {
    const { total, usado } = buildInclusoPlano(planoServicos, consumos, cfg.tipo);
    if (total > 0) map[cfg.label] = Math.max(0, total - usado);
  }
  return map;
}

/** Saldo por atividade proveniente de créditos avulsos/manuais. */
export function saldoCreditosPorAtividade(
  creditos: CreditoAlunoRow[],
): Record<string, { saldo: number; ilimitado: boolean }> {
  const map: Record<string, { saldo: number; ilimitado: boolean }> = {};
  for (const c of creditos) {
    const atual = map[c.atividade] ?? { saldo: 0, ilimitado: false };
    if (c.ilimitado) atual.ilimitado = true;
    else atual.saldo += Math.max(0, (c.quantidade_inicial ?? 0) - (c.quantidade_usada ?? 0));
    map[c.atividade] = atual;
  }
  return map;
}

/**
 * Saldo consolidado por atividade.
 *
 * Regra permanente: `creditos_aluno` é a FONTE ÚNICA de verdade. O cálculo a
 * partir de `planos.servicos` + `consumo_servicos` é apenas fallback para
 * planos antigos que não possuem linha em `creditos_aluno` — somar as duas
 * fontes duplicaria o saldo (os créditos do plano já são gravados no ledger).
 */
export function saldoTotalPorAtividade(
  planoServicos: string[] | null | undefined,
  consumos: ConsumoServico[],
  creditos: CreditoAlunoRow[],
): Record<string, { saldo: number; ilimitado: boolean }> {
  const map = saldoCreditosPorAtividade(creditos);
  const plano = saldoPlanoPorAtividade(planoServicos, consumos);
  for (const [atividade, saldo] of Object.entries(plano)) {
    if (map[atividade]) continue; // ledger tem prioridade
    map[atividade] = { saldo, ilimitado: false };
  }
  return map;
}

export type SaldoDetalhado = {
  saldoPlano: number;
  saldoAvulso: number;
  ilimitado: boolean;
};

/**
 * Saldo detalhado por atividade, separando plano e avulso.
 *
 * Regra: créditos avulsos (origem_tipo != "plano") sempre somam. O saldo
 * calculado a partir de `planos.servicos` + `consumo_servicos` só entra quando
 * NÃO existe crédito de origem "plano" no ledger para a mesma atividade —
 * nesse caso o ledger já representa o crédito do plano e somar duplicaria.
 */
export function saldoDetalhadoPorAtividade(
  planoServicos: string[] | null | undefined,
  consumos: ConsumoServico[],
  creditos: CreditoAlunoRow[],
): Record<string, SaldoDetalhado> {
  const map: Record<string, SaldoDetalhado> = {};
  const get = (atividade: string): SaldoDetalhado =>
    (map[atividade] ||= { saldoPlano: 0, saldoAvulso: 0, ilimitado: false });

  const ledgerDePlano = new Set<string>();

  for (const c of creditos) {
    const alvo = get(c.atividade);
    const daPlano = c.origem_tipo === "plano";
    if (daPlano) ledgerDePlano.add(c.atividade);
    if (c.ilimitado) {
      alvo.ilimitado = true;
      continue;
    }
    const saldo = Math.max(0, (c.quantidade_inicial ?? 0) - (c.quantidade_usada ?? 0));
    if (daPlano) alvo.saldoPlano += saldo;
    else alvo.saldoAvulso += saldo;
  }

  const plano = saldoPlanoPorAtividade(planoServicos, consumos);
  for (const [atividade, saldo] of Object.entries(plano)) {
    if (ledgerDePlano.has(atividade)) continue; // já contabilizado pelo ledger
    get(atividade).saldoPlano += saldo;
  }

  return map;
}

